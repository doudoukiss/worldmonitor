import type { Thread } from '@/types';
import { generateId, loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-threads-v1';
const listeners = new Set<() => void>();

interface ThreadStoreSnapshot {
  threads: Thread[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: ThreadStoreSnapshot = {
  threads: [],
  updatedAt: 0,
};

function cloneThread(thread: Thread): Thread {
  return {
    ...thread,
    linkedItemIds: [...thread.linkedItemIds],
    linkedNoteIds: [...thread.linkedNoteIds],
    linkedActionIds: [...thread.linkedActionIds],
    linkedFollowIds: [...thread.linkedFollowIds],
    linkedBriefRunIds: [...thread.linkedBriefRunIds],
    linkedAskRunIds: [...thread.linkedAskRunIds],
  };
}

function loadSnapshot(): ThreadStoreSnapshot {
  const snapshot = loadFromStorage<ThreadStoreSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  return {
    threads: Array.isArray(snapshot.threads) ? snapshot.threads.map(cloneThread) : [],
    updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : 0,
  };
}

function saveSnapshot(snapshot: ThreadStoreSnapshot): void {
  saveToStorage(STORAGE_KEY, {
    threads: snapshot.threads.map(cloneThread),
    updatedAt: snapshot.updatedAt,
  });
  for (const listener of listeners) listener();
}

export function listThreads(workspaceId?: string): Thread[] {
  const snapshot = loadSnapshot();
  const threads = workspaceId
    ? snapshot.threads.filter((thread) => thread.workspaceId === workspaceId)
    : snapshot.threads;
  return [...threads].map(cloneThread).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveThread(
  input: Omit<Thread, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Thread {
  const snapshot = loadSnapshot();
  const timestamp = Date.now();
  const existing = input.id
    ? snapshot.threads.find((thread) => thread.id === input.id) ?? null
    : null;

  const thread: Thread = {
    id: existing?.id ?? generateId(),
    workspaceId: input.workspaceId,
    title: input.title,
    summary: input.summary,
    linkedItemIds: [...input.linkedItemIds],
    linkedNoteIds: [...input.linkedNoteIds],
    linkedActionIds: [...input.linkedActionIds],
    linkedFollowIds: [...input.linkedFollowIds],
    linkedBriefRunIds: [...input.linkedBriefRunIds],
    linkedAskRunIds: [...input.linkedAskRunIds],
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  const nextThreads = existing
    ? snapshot.threads.map((entry) => entry.id === thread.id ? thread : entry)
    : [thread, ...snapshot.threads];

  saveSnapshot({
    threads: nextThreads,
    updatedAt: timestamp,
  });
  return thread;
}

export function deleteThread(threadId: string): void {
  const snapshot = loadSnapshot();
  saveSnapshot({
    threads: snapshot.threads.filter((thread) => thread.id !== threadId),
    updatedAt: Date.now(),
  });
}

export function subscribeThreads(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadThreadStoreSnapshot(): ThreadStoreSnapshot {
  return loadSnapshot();
}

export function saveThreadStoreSnapshot(snapshot: ThreadStoreSnapshot): void {
  saveSnapshot(snapshot);
}
