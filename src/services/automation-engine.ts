import type { AutomationEvent, AutomationRule, BriefRun, InboxItem, Workspace } from '@/types';
import { loadFromStorage, saveToStorage } from '@/utils';
import { recordAutomationEvent } from './automation-history-store';

const DISPATCH_STORAGE_KEY = 'wm-companion-automation-dispatch-v1';

interface AutomationDispatchSnapshot {
  dispatchedKeys: string[];
}

interface PendingAutomationEvent {
  dedupeKey: string;
  workspaceId: string;
  ruleId: string;
  trigger: AutomationRule['trigger'];
  title: string;
  subtitle: string;
  score: number;
  action: AutomationRule['action'];
  metadata: Record<string, string | number | boolean | null>;
}

function loadDispatchSnapshot(): AutomationDispatchSnapshot {
  return loadFromStorage<AutomationDispatchSnapshot>(DISPATCH_STORAGE_KEY, {
    dispatchedKeys: [],
  });
}

function rememberDispatch(key: string): void {
  const snapshot = loadDispatchSnapshot();
  if (snapshot.dispatchedKeys.includes(key)) return;
  saveToStorage(DISPATCH_STORAGE_KEY, {
    dispatchedKeys: [key, ...snapshot.dispatchedKeys].slice(0, 400),
  });
}

function hasDispatched(key: string): boolean {
  return loadDispatchSnapshot().dispatchedKeys.includes(key);
}

export function isAutomationRuleMuted(rule: AutomationRule, now = Date.now()): boolean {
  return typeof rule.mutedUntil === 'number' && rule.mutedUntil > now;
}

function canTriggerRule(rule: AutomationRule, now = Date.now()): boolean {
  return rule.enabled && !isAutomationRuleMuted(rule, now);
}

export function evaluateInboxAutomationRules(
  workspace: Workspace,
  rules: AutomationRule[],
  items: InboxItem[],
  now = Date.now(),
): PendingAutomationEvent[] {
  const events: PendingAutomationEvent[] = [];

  for (const rule of rules) {
    if (!canTriggerRule(rule, now)) continue;
    if (rule.trigger !== 'high_priority_item' && rule.trigger !== 'saved_item' && rule.trigger !== 'follow_hit') continue;

    for (const item of items) {
      if (item.kind === 'system') continue;
      if (item.state === 'dismissed') continue;
      if (item.score < rule.minimumScore) continue;
      if (rule.trigger === 'high_priority_item' && item.state !== 'new') continue;
      if (rule.trigger === 'saved_item' && item.state !== 'saved') continue;
      if (rule.trigger === 'follow_hit' && item.relatedFollowIds.length === 0) continue;

      const dedupeKey = `automation:${workspace.id}:${rule.id}:${item.id}:${rule.trigger}`;
      if (hasDispatched(dedupeKey)) continue;

      events.push({
        dedupeKey,
        workspaceId: workspace.id,
        ruleId: rule.id,
        trigger: rule.trigger,
        title: rule.trigger === 'saved_item'
          ? `${workspace.name}: saved item reminder`
          : rule.trigger === 'follow_hit'
            ? `${workspace.name}: follow hit`
            : `${workspace.name}: high priority signal`,
        subtitle: item.title,
        score: item.score,
        action: rule.action,
        metadata: {
          automationRuleId: rule.id,
          sourceItemId: item.id,
          trigger: rule.trigger,
        },
      });
    }
  }

  return events;
}

export function evaluateBriefAutomationRules(
  workspace: Workspace,
  rules: AutomationRule[],
  run: BriefRun,
  now = Date.now(),
): PendingAutomationEvent[] {
  const events: PendingAutomationEvent[] = [];

  for (const rule of rules) {
    if (!canTriggerRule(rule, now)) continue;
    if (rule.trigger !== 'brief_ready') continue;
    if (run.sourceCount < Math.max(1, Math.round(rule.minimumScore / 20))) continue;

    const dedupeKey = `automation:${workspace.id}:${rule.id}:${run.id}:brief_ready`;
    if (hasDispatched(dedupeKey)) continue;

    events.push({
      dedupeKey,
      workspaceId: workspace.id,
      ruleId: rule.id,
      trigger: 'brief_ready',
      title: `${workspace.name}: brief ready`,
      subtitle: run.title,
      score: run.sourceCount,
      action: rule.action,
      metadata: {
        automationRuleId: rule.id,
        briefRunId: run.id,
        trigger: 'brief_ready',
      },
    });
  }

  return events;
}

export function evaluateWorkspaceAutomationRules(
  workspace: Workspace,
  rules: AutomationRule[],
  context: {
    previousVisitedAt: number | null | undefined;
    latestBriefGeneratedAt: number | null;
  },
  now = Date.now(),
): PendingAutomationEvent[] {
  const events: PendingAutomationEvent[] = [];

  for (const rule of rules) {
    if (!canTriggerRule(rule, now)) continue;
    if (rule.trigger !== 'stale_workspace') continue;

    const visitGapMs = context.previousVisitedAt == null ? Number.POSITIVE_INFINITY : now - context.previousVisitedAt;
    const minimumGapMs = Math.max(6, Math.round(rule.minimumScore / 5)) * 60 * 60 * 1000;
    if (visitGapMs < minimumGapMs) continue;

    const dedupeBucket = new Date(now).toISOString().slice(0, 10);
    const dedupeKey = `automation:${workspace.id}:${rule.id}:stale_workspace:${dedupeBucket}`;
    if (hasDispatched(dedupeKey)) continue;

    events.push({
      dedupeKey,
      workspaceId: workspace.id,
      ruleId: rule.id,
      trigger: 'stale_workspace',
      title: `${workspace.name}: workspace revisit`,
      subtitle: context.latestBriefGeneratedAt
        ? 'Fresh context is due because this workspace has been inactive.'
        : 'No recent brief exists and this workspace has been inactive.',
      score: Math.round(Math.min(100, visitGapMs / (60 * 60 * 1000))),
      action: rule.action,
      metadata: {
        automationRuleId: rule.id,
        trigger: 'stale_workspace',
        previousVisitedAt: context.previousVisitedAt ?? 0,
        latestBriefGeneratedAt: context.latestBriefGeneratedAt ?? 0,
      },
    });
  }

  return events;
}

export function commitAutomationEvent(event: PendingAutomationEvent | AutomationEvent): AutomationEvent {
  const committedEvent: AutomationEvent = 'id' in event
    ? event
    : {
      id: event.dedupeKey,
      workspaceId: event.workspaceId,
      ruleId: event.ruleId,
      trigger: event.trigger,
      action: event.action,
      title: event.title,
      subtitle: event.subtitle,
      score: event.score,
      dedupeKey: event.dedupeKey,
      metadata: event.metadata,
      createdAt: Date.now(),
    };

  rememberDispatch(committedEvent.dedupeKey);
  recordAutomationEvent(committedEvent);
  if (committedEvent.action === 'queue_brief') return committedEvent;
  if (committedEvent.action !== 'desktop') return committedEvent;
  if (typeof Notification === 'undefined') return committedEvent;

  const show = (): void => {
    try {
      new Notification(committedEvent.title, { body: committedEvent.subtitle });
    } catch {}
  };

  if (Notification.permission === 'granted') {
    show();
    return committedEvent;
  }

  if (Notification.permission === 'default') {
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') show();
    }).catch(() => {});
  }
  return committedEvent;
}
