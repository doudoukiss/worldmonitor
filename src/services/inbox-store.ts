import type { InboxItem } from '@/types';
import { loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-inbox-v1';

export const MAX_INBOX_ITEMS = 300;

export interface InboxStoreSnapshot {
  items: InboxItem[];
  lastSyncedAt: number | null;
}

const DEFAULT_SNAPSHOT: InboxStoreSnapshot = {
  items: [],
  lastSyncedAt: null,
};

export function cloneInboxItem(item: InboxItem): InboxItem {
  return {
    ...item,
    workspaceIds: [...item.workspaceIds],
    relatedFollowIds: [...item.relatedFollowIds],
    tags: Array.isArray(item.tags) ? [...item.tags] : [],
    snoozedUntil: typeof item.snoozedUntil === 'number' ? item.snoozedUntil : null,
    feedback: item.feedback ?? null,
    metadata: item.metadata ? { ...item.metadata } : undefined,
  };
}

export function isInboxItemCurrentlySnoozed(item: InboxItem, now = Date.now()): boolean {
  return item.state === 'snoozed'
    && typeof item.snoozedUntil === 'number'
    && item.snoozedUntil > now;
}

export function sortInboxItems(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.occurredAt - a.occurredAt;
  });
}

export function loadInboxStoreSnapshot(): InboxStoreSnapshot {
  const snapshot = loadFromStorage<InboxStoreSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  return {
    items: Array.isArray(snapshot.items) ? snapshot.items.map(cloneInboxItem) : [],
    lastSyncedAt: typeof snapshot.lastSyncedAt === 'number' ? snapshot.lastSyncedAt : null,
  };
}

export function saveInboxStoreSnapshot(snapshot: InboxStoreSnapshot): void {
  saveToStorage(STORAGE_KEY, {
    items: snapshot.items.map(cloneInboxItem),
    lastSyncedAt: snapshot.lastSyncedAt,
  });
}
