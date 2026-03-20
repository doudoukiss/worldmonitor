import type { BriefRecipe, BriefRun, InboxItem, Thread, Workspace } from '@/types';
import { isInboxItemCurrentlySnoozed } from './inbox-store';
import { generateSummary } from './summarization';
import { generateId } from '@/utils';

interface BuildWorkspaceBriefRunOptions {
  workspace: Workspace;
  recipe: BriefRecipe;
  items: InboxItem[];
  threads?: Thread[];
  previousVisitedAt?: number | null;
  now?: number;
}

function selectRelevantThreadsForBrief(items: InboxItem[], threads: Thread[]): Thread[] {
  const itemIds = new Set(items.map((item) => item.id));
  return [...threads]
    .map((thread) => {
      let score = 0;
      for (const id of thread.linkedItemIds) {
        if (itemIds.has(id)) score += 3;
      }
      score += Math.min(thread.linkedNoteIds.length, 2);
      score += Math.min(thread.linkedActionIds.length, 2);
      return { thread, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.thread);
}

export function selectWorkspaceBriefItems(
  recipe: BriefRecipe,
  items: InboxItem[],
  previousVisitedAt: number | null | undefined,
): InboxItem[] {
  const visibleItems = items.filter((item) => item.state !== 'dismissed' && !isInboxItemCurrentlySnoozed(item));
  const highSignalItems = visibleItems.filter((item) => item.kind !== 'system');
  const rankItems = (entries: InboxItem[]) => [...entries]
    .sort((a, b) => scoreBriefPriority(b, recipe, previousVisitedAt) - scoreBriefPriority(a, recipe, previousVisitedAt))
    .slice(0, 8);

  if (recipe.kind === 'workspace_delta') {
    const deltaItems = highSignalItems.filter((item) => (
      previousVisitedAt != null
        ? item.occurredAt > previousVisitedAt
        : item.state === 'new'
    ));
    return rankItems(deltaItems.length > 0 ? deltaItems : highSignalItems);
  }

  return rankItems(highSignalItems.length > 0 ? highSignalItems : visibleItems);
}

function scoreBriefPriority(
  item: InboxItem,
  recipe: BriefRecipe,
  previousVisitedAt: number | null | undefined,
): number {
  let score = item.score;

  if (item.state === 'saved') score += 30;
  if (item.tags.includes('watch')) score += 12;
  if (item.tags.includes('read_later')) score += 6;

  if (item.feedback === 'useful') score += 24;
  if (item.feedback === 'not_useful') score -= 20;
  if (item.feedback === 'too_noisy') score -= 35;

  if (recipe.kind === 'workspace_delta') {
    const isNewSinceVisit = previousVisitedAt == null
      ? item.state === 'new'
      : item.occurredAt > previousVisitedAt;
    if (isNewSinceVisit) score += 18;
  }

  return score;
}

export function buildWorkspaceBriefInputSignature(
  recipe: BriefRecipe,
  items: InboxItem[],
  previousVisitedAt: number | null | undefined,
): string {
  const itemSignature = items.map((item) => item.id).join('|');
  const visitWindow = recipe.kind === 'workspace_delta'
    ? String(previousVisitedAt ?? 0)
    : 'morning';
  return `${recipe.id}:${visitWindow}:${itemSignature}`;
}

function toHeadline(item: InboxItem): string {
  if (item.kind === 'quote_move') {
    return `${item.title}. ${item.subtitle || 'Market signal.'}`;
  }
  if (item.kind === 'prediction') {
    return `${item.title}. ${item.subtitle || 'Prediction market signal.'}`;
  }
  return item.subtitle ? `${item.title}. ${item.subtitle}` : item.title;
}

function summarizeKinds(items: InboxItem[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([kind, count]) => `${count} ${kind.replace(/_/g, ' ')}`)
    .join(', ');
}

function buildFallbackSummary(
  workspace: Workspace,
  recipe: BriefRecipe,
  items: InboxItem[],
  previousVisitedAt: number | null | undefined,
): string {
  if (items.length === 0) {
    return recipe.kind === 'workspace_delta'
      ? `No new items were detected for ${workspace.name} since the last visit.`
      : `No companion items are available yet for ${workspace.name}.`;
  }

  const lead = items.slice(0, 3).map((item) => item.title).join('; ');
  const kindSummary = summarizeKinds(items);

  if (recipe.kind === 'workspace_delta') {
    const deltaContext = previousVisitedAt == null
      ? 'No previous visit timestamp is stored yet, so this delta uses the newest saved signals.'
      : 'These are the strongest signals detected since the previous visit.';
    return `${deltaContext} In ${workspace.name}, the key changes are: ${lead}. Mix: ${kindSummary}.`;
  }

  return `Morning brief for ${workspace.name}: focus first on ${lead}. Current mix: ${kindSummary}.`;
}

export async function buildWorkspaceBriefRun(
  options: BuildWorkspaceBriefRunOptions,
): Promise<BriefRun> {
  const generatedAt = options.now ?? Date.now();
  const candidateItems = selectWorkspaceBriefItems(
    options.recipe,
    options.items,
    options.previousVisitedAt,
  );
  const sourceItemIds = candidateItems.map((item) => item.id);
  const inputSignature = buildWorkspaceBriefInputSignature(
    options.recipe,
    candidateItems,
    options.previousVisitedAt,
  );

  let summary = buildFallbackSummary(
    options.workspace,
    options.recipe,
    candidateItems,
    options.previousVisitedAt,
  );
  const relevantThreads = selectRelevantThreadsForBrief(candidateItems, options.threads ?? []);

  const headlineInputs = candidateItems.map((item) => toHeadline(item));
  if (headlineInputs.length >= 2) {
    const context = `${options.workspace.name}. Follows: ${options.workspace.follows
      .slice(0, 5)
      .map((follow) => follow.label)
      .join(', ')}. Threads: ${relevantThreads.map((thread) => thread.title).join(', ')}`;

    try {
      const result = await generateSummary(headlineInputs, undefined, context, 'en');
      if (result?.summary) {
        summary = result.summary.trim();
      }
    } catch (error) {
      console.warn('[CompanionBriefing] Falling back to rules-based summary:', error);
    }
  }

  return {
    id: generateId(),
    workspaceId: options.workspace.id,
    recipeId: options.recipe.id,
    kind: options.recipe.kind,
    title: options.recipe.title,
    summary,
    sourceItemIds,
    sourceCount: sourceItemIds.length,
    inputSignature,
    generatedAt,
    status: 'ready',
  };
}
