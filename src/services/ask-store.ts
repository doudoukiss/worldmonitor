import type { AskRun } from '@/types';
import { generateId, loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-ask-runs-v1';
const MAX_ASK_RUNS = 120;
const listeners = new Set<() => void>();

interface AskStoreSnapshot {
  runs: AskRun[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: AskStoreSnapshot = {
  runs: [],
  updatedAt: 0,
};

function cloneAskRun(run: AskRun): AskRun {
  return {
    ...run,
    citedItemIds: [...run.citedItemIds],
    citedBriefRunIds: [...run.citedBriefRunIds],
    citedNoteIds: [...run.citedNoteIds],
    citedFollowIds: [...(run.citedFollowIds ?? [])],
    citedThreadIds: [...(run.citedThreadIds ?? [])],
  };
}

function loadSnapshot(): AskStoreSnapshot {
  const snapshot = loadFromStorage<AskStoreSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  return {
    runs: Array.isArray(snapshot.runs) ? snapshot.runs.map(cloneAskRun) : [],
    updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : 0,
  };
}

function saveSnapshot(snapshot: AskStoreSnapshot): void {
  saveToStorage(STORAGE_KEY, {
    runs: snapshot.runs.map(cloneAskRun).slice(0, MAX_ASK_RUNS),
    updatedAt: snapshot.updatedAt,
  });
  for (const listener of listeners) listener();
}

export function listAskRuns(workspaceId?: string): AskRun[] {
  const snapshot = loadSnapshot();
  const runs = workspaceId
    ? snapshot.runs.filter((run) => run.workspaceId === workspaceId)
    : snapshot.runs;
  return [...runs].map(cloneAskRun).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveAskRun(
  input: Omit<AskRun, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): AskRun {
  const snapshot = loadSnapshot();
  const timestamp = Date.now();
  const existing = input.id
    ? snapshot.runs.find((run) => run.id === input.id) ?? null
    : null;

  const run: AskRun = {
    id: existing?.id ?? generateId(),
    workspaceId: input.workspaceId,
    intent: input.intent,
    question: input.question,
    answer: input.answer,
    citedItemIds: [...input.citedItemIds],
    citedBriefRunIds: [...input.citedBriefRunIds],
    citedNoteIds: [...input.citedNoteIds],
    citedFollowIds: [...input.citedFollowIds],
    citedThreadIds: [...input.citedThreadIds],
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  const nextRuns = [
    run,
    ...snapshot.runs.filter((entry) => entry.id !== run.id),
  ].slice(0, MAX_ASK_RUNS);

  saveSnapshot({
    runs: nextRuns,
    updatedAt: timestamp,
  });

  return run;
}

export function subscribeAskRuns(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadAskStoreSnapshot(): AskStoreSnapshot {
  return loadSnapshot();
}

export function saveAskStoreSnapshot(snapshot: AskStoreSnapshot): void {
  saveSnapshot(snapshot);
}
