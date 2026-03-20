import type { ActionItem } from '@/types';
import { loadFromStorage, saveToStorage, generateId } from '@/utils';

const STORAGE_KEY = 'wm-companion-actions-v1';
const listeners = new Set<() => void>();

interface ActionStoreSnapshot {
  actions: ActionItem[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: ActionStoreSnapshot = {
  actions: [],
  updatedAt: 0,
};

function cloneAction(action: ActionItem): ActionItem {
  return {
    ...action,
    relatedItemIds: Array.isArray(action.relatedItemIds) ? [...action.relatedItemIds] : [],
    relatedFollowIds: Array.isArray(action.relatedFollowIds) ? [...action.relatedFollowIds] : [],
    dueAt: typeof action.dueAt === 'number' ? action.dueAt : null,
  };
}

function loadSnapshot(): ActionStoreSnapshot {
  return loadFromStorage<ActionStoreSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
}

function saveSnapshot(snapshot: ActionStoreSnapshot): void {
  saveToStorage(STORAGE_KEY, snapshot);
  for (const listener of listeners) listener();
}

export function loadActionStoreSnapshot(): ActionStoreSnapshot {
  return loadSnapshot();
}

export function saveActionStoreSnapshot(snapshot: ActionStoreSnapshot): void {
  saveSnapshot(snapshot);
}

export function listActions(workspaceId?: string): ActionItem[] {
  const snapshot = loadSnapshot();
  const actions = workspaceId
    ? snapshot.actions.filter((action) => action.workspaceId === workspaceId)
    : snapshot.actions;
  return [...actions].map(cloneAction).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveAction(
  input: Omit<ActionItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): ActionItem {
  const snapshot = loadSnapshot();
  const timestamp = Date.now();
  const existing = input.id
    ? snapshot.actions.find((action) => action.id === input.id) ?? null
    : null;

  const action: ActionItem = {
    id: existing?.id ?? generateId(),
    workspaceId: input.workspaceId,
    title: input.title,
    status: input.status,
    relatedItemIds: Array.isArray(input.relatedItemIds) ? [...input.relatedItemIds] : [],
    relatedFollowIds: Array.isArray(input.relatedFollowIds) ? [...input.relatedFollowIds] : [],
    dueAt: typeof input.dueAt === 'number' ? input.dueAt : null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  const nextActions = existing
    ? snapshot.actions.map((entry) => entry.id === action.id ? action : entry)
    : [action, ...snapshot.actions];

  saveSnapshot({
    actions: nextActions,
    updatedAt: timestamp,
  });
  return action;
}

export function setActionStatus(actionId: string, status: ActionItem['status']): void {
  const snapshot = loadSnapshot();
  saveSnapshot({
    actions: snapshot.actions.map((action) => (
      action.id === actionId
        ? { ...action, status, updatedAt: Date.now() }
        : action
    )),
    updatedAt: Date.now(),
  });
}

export function deleteAction(actionId: string): void {
  const snapshot = loadSnapshot();
  saveSnapshot({
    actions: snapshot.actions.filter((action) => action.id !== actionId),
    updatedAt: Date.now(),
  });
}

export function subscribeActions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
