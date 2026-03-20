import type { AutomationEvent } from '@/types';
import { generateId, loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-automation-history-v1';
const listeners = new Set<() => void>();

interface AutomationHistorySnapshot {
  events: AutomationEvent[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: AutomationHistorySnapshot = {
  events: [],
  updatedAt: 0,
};

function cloneEvent(event: AutomationEvent): AutomationEvent {
  return {
    ...event,
    metadata: { ...event.metadata },
  };
}

function loadSnapshot(): AutomationHistorySnapshot {
  const snapshot = loadFromStorage<AutomationHistorySnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  return {
    events: Array.isArray(snapshot.events) ? snapshot.events.map(cloneEvent) : [],
    updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : 0,
  };
}

function saveSnapshot(snapshot: AutomationHistorySnapshot): void {
  saveToStorage(STORAGE_KEY, {
    events: snapshot.events.map(cloneEvent).slice(0, 250),
    updatedAt: snapshot.updatedAt,
  });
  for (const listener of listeners) listener();
}

export function listAutomationEvents(workspaceId?: string): AutomationEvent[] {
  const snapshot = loadSnapshot();
  const events = workspaceId
    ? snapshot.events.filter((event) => event.workspaceId === workspaceId)
    : snapshot.events;
  return [...events].map(cloneEvent).sort((a, b) => b.createdAt - a.createdAt);
}

export function recordAutomationEvent(
  input: Omit<AutomationEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
): AutomationEvent {
  const snapshot = loadSnapshot();
  const timestamp = input.createdAt ?? Date.now();
  const event: AutomationEvent = {
    id: input.id ?? generateId(),
    workspaceId: input.workspaceId,
    ruleId: input.ruleId,
    trigger: input.trigger,
    action: input.action,
    title: input.title,
    subtitle: input.subtitle,
    score: input.score,
    dedupeKey: input.dedupeKey,
    metadata: { ...input.metadata },
    createdAt: timestamp,
  };
  saveSnapshot({
    events: [event, ...snapshot.events.filter((entry) => entry.dedupeKey !== event.dedupeKey)],
    updatedAt: timestamp,
  });
  return event;
}

export function loadAutomationHistorySnapshot(): AutomationHistorySnapshot {
  return loadSnapshot();
}

export function saveAutomationHistorySnapshot(snapshot: AutomationHistorySnapshot): void {
  saveSnapshot(snapshot);
}

export function subscribeAutomationHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
