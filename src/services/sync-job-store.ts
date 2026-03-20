import type { SyncJob } from '@/types';
import { generateId, loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-sync-jobs-v1';
const listeners = new Set<() => void>();

interface SyncJobSnapshot {
  jobs: SyncJob[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: SyncJobSnapshot = {
  jobs: [],
  updatedAt: 0,
};

function cloneJob(job: SyncJob): SyncJob {
  return { ...job };
}

function loadSnapshot(): SyncJobSnapshot {
  const snapshot = loadFromStorage<SyncJobSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  return {
    jobs: Array.isArray(snapshot.jobs) ? snapshot.jobs.map(cloneJob) : [],
    updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : 0,
  };
}

function saveSnapshot(snapshot: SyncJobSnapshot): void {
  saveToStorage(STORAGE_KEY, {
    jobs: snapshot.jobs.map(cloneJob).slice(0, 100),
    updatedAt: snapshot.updatedAt,
  });
  for (const listener of listeners) listener();
}

export function listSyncJobs(): SyncJob[] {
  return [...loadSnapshot().jobs].map(cloneJob).sort((a, b) => b.createdAt - a.createdAt);
}

export function recordSyncJob(input: Omit<SyncJob, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): SyncJob {
  const snapshot = loadSnapshot();
  const createdAt = input.createdAt ?? Date.now();
  const job: SyncJob = {
    id: input.id ?? generateId(),
    provider: input.provider,
    operation: input.operation,
    status: input.status,
    syncChannel: input.syncChannel,
    fingerprint: input.fingerprint ?? null,
    remoteFingerprint: input.remoteFingerprint ?? null,
    message: input.message,
    createdAt,
  };
  saveSnapshot({
    jobs: [job, ...snapshot.jobs],
    updatedAt: createdAt,
  });
  return job;
}

export function subscribeSyncJobs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadSyncJobSnapshot(): SyncJobSnapshot {
  return loadSnapshot();
}

export function saveSyncJobSnapshot(snapshot: SyncJobSnapshot): void {
  saveSnapshot(snapshot);
}
