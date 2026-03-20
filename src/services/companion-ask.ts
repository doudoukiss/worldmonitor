import type { AskRun, BriefRun, Follow, InboxItem, MemoryNote, Thread, Workspace } from '@/types';
import { generateSummary } from './summarization';
import { generateId } from '@/utils';

interface BuildWorkspaceAskRunOptions {
  workspace: Workspace;
  question: string;
  items: InboxItem[];
  briefRuns: BriefRun[];
  notes: MemoryNote[];
  threads?: Thread[];
  now?: number;
}

function normalize(value: string): string {
  return value.toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function detectIntent(question: string): AskRun['intent'] {
  const normalized = normalize(question);
  if (/\b(compare|vs|versus)\b/.test(normalized)) return 'compare';
  if (/\b(why|why does|why is)\b/.test(normalized)) return 'why';
  if (/\b(explain|what is|how does)\b/.test(normalized)) return 'explain';
  return 'general';
}

function tokenize(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function splitComparisonTargets(question: string): string[] {
  const normalized = question.trim();
  const versusMatch = normalized.match(/(.+?)\s+(?:vs|versus|compare)\s+(.+)/i);
  if (!versusMatch) return [];
  return unique(
    versusMatch
      .slice(1)
      .map((part) => part.replace(/\b(and|the|between)\b/gi, ' ').trim())
      .filter((part) => part.length >= 2),
  ).slice(0, 2);
}

function scoreMatch(haystack: string, terms: string[]): number {
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 1;
  }
  return score;
}

function selectRelevantItems(question: string, items: InboxItem[]): InboxItem[] {
  const terms = tokenize(question);
  return [...items]
    .map((item) => {
      const haystack = normalize(`${item.title} ${item.subtitle || ''} ${item.source}`);
      const matched = scoreMatch(haystack, terms);
      const score = item.score + matched * 20 + (item.state === 'saved' ? 12 : 0);
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.item);
}

function selectRelevantBriefs(question: string, runs: BriefRun[]): BriefRun[] {
  const terms = tokenize(question);
  return [...runs]
    .map((run) => {
      const haystack = normalize(`${run.title} ${run.summary}`);
      return { run, score: scoreMatch(haystack, terms) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.run);
}

function selectRelevantNotes(question: string, notes: MemoryNote[]): MemoryNote[] {
  const terms = tokenize(question);
  return [...notes]
    .map((note) => {
      const haystack = normalize(`${note.title} ${note.body}`);
      return { note, score: scoreMatch(haystack, terms) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.note);
}

function selectRelevantFollows(question: string, follows: Follow[]): Follow[] {
  const terms = tokenize(question);
  return [...follows]
    .map((follow) => {
      const haystack = normalize(`${follow.label} ${follow.query} ${follow.note || ''}`);
      return { follow, score: scoreMatch(haystack, terms) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.follow);
}

function describeItem(item: InboxItem): string {
  const parts = [item.title];
  if (item.subtitle) parts.push(item.subtitle);
  parts.push(`${item.source} score ${item.score}`);
  if (item.state === 'saved') parts.push('saved');
  return parts.join(' | ');
}

function describeBrief(run: BriefRun): string {
  return `${run.title} | ${run.summary}`;
}

function describeNote(note: MemoryNote): string {
  return `${note.title} | ${note.body}`;
}

function describeFollow(follow: Follow): string {
  return `${follow.label} | ${follow.query}`;
}

function describeThread(thread: Thread): string {
  return `${thread.title} | ${thread.summary}`;
}

function selectRelevantThreads(question: string, threads: Thread[]): Thread[] {
  const terms = tokenize(question);
  return [...threads]
    .map((thread) => {
      const haystack = normalize(`${thread.title} ${thread.summary}`);
      return { thread, score: scoreMatch(haystack, terms) + thread.linkedItemIds.length + thread.linkedNoteIds.length };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.thread);
}

function selectItemsForTarget(target: string, items: InboxItem[]): InboxItem[] {
  const terms = tokenize(target);
  return [...items]
    .map((item) => {
      const haystack = normalize(`${item.title} ${item.subtitle || ''} ${item.source}`);
      return { item, score: scoreMatch(haystack, terms) + item.score / 100 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.item);
}

function buildCompareAnswer(
  workspace: Workspace,
  question: string,
  items: InboxItem[],
  briefs: BriefRun[],
  notes: MemoryNote[],
  follows: Follow[],
  threads: Thread[],
): string {
  const targets = splitComparisonTargets(question);
  if (targets.length >= 2) {
    const leftTarget = targets[0] ?? 'left side';
    const rightTarget = targets[1] ?? 'right side';
    const leftItems = selectItemsForTarget(leftTarget, items);
    const rightItems = selectItemsForTarget(rightTarget, items);
    const leftLead = leftItems[0]?.title ?? leftTarget;
    const rightLead = rightItems[0]?.title ?? rightTarget;
    const leftWeight = leftItems.reduce((sum, item) => sum + item.score, 0);
    const rightWeight = rightItems.reduce((sum, item) => sum + item.score, 0);
    const stronger = leftWeight === rightWeight
      ? 'neither side clearly dominates'
      : leftWeight > rightWeight
        ? `${leftTarget} has the stronger current signal`
        : `${rightTarget} has the stronger current signal`;

    const evidence: string[] = [
      `${leftTarget}: ${leftItems.length > 0 ? leftItems.map((item) => item.title).join('; ') : 'little direct workspace signal'}`,
      `${rightTarget}: ${rightItems.length > 0 ? rightItems.map((item) => item.title).join('; ') : 'little direct workspace signal'}`,
    ];
    if (briefs.length > 0) evidence.push(`Recent brief context: ${briefs[0]?.title}`);
    if (notes.length > 0) evidence.push(`Durable note context: ${notes[0]?.title}`);
    if (follows.length > 0) evidence.push(`Tracked follow overlap: ${follows.map((follow) => follow.label).join('; ')}`);
    if (threads.length > 0) evidence.push(`Thread context: ${threads.map((thread) => thread.title).join('; ')}`);

    return `Comparison for ${workspace.name}: ${stronger}. ${leftTarget} is represented by ${leftLead}, while ${rightTarget} is represented by ${rightLead}. ${evidence.join('. ')}.`;
  }

  const compared = items.slice(0, 2).map((item) => item.title);
  if (compared.length >= 2) {
    return `Comparison for ${workspace.name}: ${compared[0]} currently ranks above ${compared[1]} in live workspace context. The lead item has stronger score weight or more supporting saved context.`;
  }

  return buildGeneralAnswer(workspace, items, briefs, notes, follows, threads);
}

function buildWhyAnswer(
  workspace: Workspace,
  items: InboxItem[],
  briefs: BriefRun[],
  notes: MemoryNote[],
  follows: Follow[],
  threads: Thread[],
): string {
  const lead = items[0]?.title ?? briefs[0]?.title ?? notes[0]?.title ?? follows[0]?.label;
  const reasons: string[] = [];
  if (items.length > 0) reasons.push(`it is reinforced by ${items.slice(0, 2).map((item) => item.title).join('; ')}`);
  if (briefs.length > 0) reasons.push(`recent briefs already touched ${briefs[0]?.title}`);
  if (notes.length > 0) reasons.push(`your saved notes connect to ${notes[0]?.title}`);
  if (follows.length > 0) reasons.push(`it overlaps with followed topics like ${follows.map((follow) => follow.label).join('; ')}`);
  if (threads.length > 0) reasons.push(`it fits existing threads such as ${threads.map((thread) => thread.title).join('; ')}`);
  return `Why this matters in ${workspace.name}: ${lead} is not isolated noise because ${reasons.join(', ')}. The workspace context suggests it has continuity with what you are already tracking.`;
}

function buildExplainAnswer(
  workspace: Workspace,
  items: InboxItem[],
  briefs: BriefRun[],
  notes: MemoryNote[],
  follows: Follow[],
  threads: Thread[],
): string {
  const lead = items[0]?.title ?? briefs[0]?.title ?? notes[0]?.title ?? follows[0]?.label;
  const context: string[] = [];
  if (items.length > 0) context.push(`current signals include ${items.slice(0, 2).map((item) => item.title).join('; ')}`);
  if (briefs.length > 0) context.push(`recent brief context includes ${briefs[0]?.title}`);
  if (notes.length > 0) context.push(`saved notes mention ${notes[0]?.title}`);
  if (follows.length > 0) context.push(`the closest tracked follows are ${follows.map((follow) => follow.label).join('; ')}`);
  if (threads.length > 0) context.push(`the nearest durable threads are ${threads.map((thread) => thread.title).join('; ')}`);
  return `Explanation for ${workspace.name}: ${lead} should be read in context, not as a standalone headline. In this workspace, ${context.join(', ')}.`;
}

function buildGeneralAnswer(
  workspace: Workspace,
  items: InboxItem[],
  briefs: BriefRun[],
  notes: MemoryNote[],
  follows: Follow[],
  threads: Thread[],
): string {
  const lines: string[] = [];
  if (items.length > 0) lines.push(`Signals: ${items.map((item) => item.title).join('; ')}.`);
  if (briefs.length > 0) lines.push(`Recent briefs: ${briefs.map((run) => run.title).join('; ')}.`);
  if (notes.length > 0) lines.push(`Relevant notes: ${notes.map((note) => note.title).join('; ')}.`);
  if (follows.length > 0) lines.push(`Tracked follows: ${follows.map((follow) => follow.label).join('; ')}.`);
  if (threads.length > 0) lines.push(`Durable threads: ${threads.map((thread) => thread.title).join('; ')}.`);
  return `Workspace answer for ${workspace.name}: ${lines.join(' ')}`;
}

function buildIntentPrompt(
  workspace: Workspace,
  question: string,
  intent: AskRun['intent'],
): string {
  switch (intent) {
    case 'compare':
      return `Workspace: ${workspace.name}. Question: ${question}. Compare the strongest competing contexts only from the provided evidence. State which side appears stronger and why. Keep it under 140 words.`;
    case 'why':
      return `Workspace: ${workspace.name}. Question: ${question}. Explain why this matters using only the provided evidence. Emphasize continuity with follows, briefs, or notes. Keep it under 120 words.`;
    case 'explain':
      return `Workspace: ${workspace.name}. Question: ${question}. Explain the topic in workspace terms using only the provided evidence. Keep it specific and under 120 words.`;
    case 'general':
    default:
      return `Workspace: ${workspace.name}. Question: ${question}. Answer using only the provided workspace context and keep the response specific. Keep it under 120 words.`;
  }
}

function buildFallbackAnswer(
  workspace: Workspace,
  question: string,
  intent: AskRun['intent'],
  items: InboxItem[],
  briefs: BriefRun[],
  notes: MemoryNote[],
  follows: Follow[],
  threads: Thread[],
): string {
  if (items.length === 0 && briefs.length === 0 && notes.length === 0 && follows.length === 0) {
    return `I do not have enough saved workspace context yet to answer "${question}" for ${workspace.name}.`;
  }

  switch (intent) {
    case 'compare':
      return buildCompareAnswer(workspace, question, items, briefs, notes, follows, threads);
    case 'why':
      return buildWhyAnswer(workspace, items, briefs, notes, follows, threads);
    case 'explain':
      return buildExplainAnswer(workspace, items, briefs, notes, follows, threads);
    case 'general':
    default:
      return buildGeneralAnswer(workspace, items, briefs, notes, follows, threads);
  }
}

export async function buildWorkspaceAskRun(
  options: BuildWorkspaceAskRunOptions,
): Promise<AskRun> {
  const createdAt = options.now ?? Date.now();
  const intent = detectIntent(options.question);
  const relevantItems = selectRelevantItems(options.question, options.items);
  const relevantBriefs = selectRelevantBriefs(options.question, options.briefRuns);
  const relevantNotes = selectRelevantNotes(options.question, options.notes);
  const relevantFollows = selectRelevantFollows(options.question, options.workspace.follows);
  const relevantThreads = selectRelevantThreads(options.question, options.threads ?? []);

  let answer = buildFallbackAnswer(
    options.workspace,
    options.question,
    intent,
    relevantItems,
    relevantBriefs,
    relevantNotes,
    relevantFollows,
    relevantThreads,
  );

  const contextBlocks = [
    ...relevantItems.map((item) => `Signal: ${describeItem(item)}`),
    ...relevantBriefs.map((run) => `Brief: ${describeBrief(run)}`),
    ...relevantNotes.map((note) => `Note: ${describeNote(note)}`),
    ...relevantFollows.map((follow) => `Follow: ${describeFollow(follow)}`),
    ...relevantThreads.map((thread) => `Thread: ${describeThread(thread)}`),
  ];

  if (contextBlocks.length >= 2) {
    try {
      const result = await generateSummary(
        contextBlocks,
        undefined,
        buildIntentPrompt(options.workspace, options.question, intent),
        'en',
      );
      if (result?.summary?.trim()) {
        answer = result.summary.trim();
      }
    } catch (error) {
      console.warn('[CompanionAsk] Falling back to rules-based answer:', error);
    }
  }

  return {
    id: generateId(),
    workspaceId: options.workspace.id,
    intent,
    question: options.question,
    answer,
    citedItemIds: relevantItems.map((item) => item.id),
    citedBriefRunIds: relevantBriefs.map((run) => run.id),
    citedNoteIds: relevantNotes.map((note) => note.id),
    citedFollowIds: relevantFollows.map((follow) => follow.id),
    citedThreadIds: relevantThreads.map((thread) => thread.id),
    createdAt,
    updatedAt: createdAt,
  };
}
