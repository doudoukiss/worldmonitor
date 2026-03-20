import type { MarketData, NewsItem, InboxItem, Workspace, Follow } from '@/types';
import type { PredictionMarket } from '@/services/prediction';
import {
  MAX_INBOX_ITEMS,
  cloneInboxItem,
  isInboxItemCurrentlySnoozed,
  loadInboxStoreSnapshot,
  saveInboxStoreSnapshot,
  sortInboxItems,
} from '@/services/inbox-store';

export interface InboxSyncInput {
  workspace: Workspace;
  news: NewsItem[];
  markets: MarketData[];
  predictions: PredictionMarket[];
}

export interface InboxSummary {
  total: number;
  unread: number;
  saved: number;
  dismissed: number;
  snoozed: number;
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function scoreNewsItem(item: NewsItem, follows: Follow[]): { score: number; followIds: string[] } {
  const haystack = normalize(`${item.title} ${item.source} ${item.locationName || ''}`);
  const followIds = follows
    .filter((follow) => {
      if (follow.kind === 'ticker' && follow.symbol) {
        const symbol = normalize(follow.symbol);
        const label = normalize(follow.label);
        return haystack.includes(symbol) || haystack.includes(label);
      }
      if (follow.kind === 'keyword_set' && follow.keywords?.length) {
        return follow.keywords.some((keyword) => haystack.includes(normalize(keyword)));
      }
      return haystack.includes(normalize(follow.label));
    })
    .map((follow) => follow.id);

  let score = item.isAlert ? 70 : 20;
  score += followIds.length * 25;
  if (item.threat?.level === 'critical') score += 20;
  if (item.threat?.level === 'high') score += 10;

  return { score, followIds };
}

function scoreMarketItem(item: MarketData, follows: Follow[]): { score: number; followIds: string[] } {
  const followIds = follows
    .filter((follow) => follow.kind === 'ticker' && follow.symbol === item.symbol)
    .map((follow) => follow.id);

  let score = Math.round(Math.abs(item.change ?? 0) * 10);
  if (followIds.length > 0) score += 35;
  return { score, followIds };
}

function scorePredictionItem(item: PredictionMarket, follows: Follow[]): { score: number; followIds: string[] } {
  const haystack = normalize(item.title);
  const followIds = follows
    .filter((follow) => {
      if (follow.kind === 'ticker' && follow.symbol) {
        return haystack.includes(normalize(follow.symbol));
      }
      if (follow.kind === 'keyword_set' && follow.keywords?.length) {
        return follow.keywords.some((keyword) => haystack.includes(normalize(keyword)));
      }
      return haystack.includes(normalize(follow.label));
    })
    .map((follow) => follow.id);

  let score = Math.round((item.volume ?? 0) / 10_000);
  score += followIds.length * 20;
  return { score, followIds };
}

export class InboxStore {
  private snapshot = loadInboxStoreSnapshot();
  private listeners = new Set<() => void>();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public listItems(workspaceId?: string): InboxItem[] {
    const items = workspaceId
      ? this.snapshot.items.filter((item) => item.workspaceIds.includes(workspaceId))
      : this.snapshot.items;
    return sortInboxItems(items).map(cloneInboxItem);
  }

  public getWorkspaceSummary(workspaceId: string): InboxSummary {
    const items = this.snapshot.items.filter((item) => item.workspaceIds.includes(workspaceId));
    return {
      total: items.length,
      unread: items.filter((item) => item.state === 'new').length,
      saved: items.filter((item) => item.state === 'saved').length,
      dismissed: items.filter((item) => item.state === 'dismissed').length,
      snoozed: items.filter((item) => isInboxItemCurrentlySnoozed(item)).length,
    };
  }

  public setItemState(itemId: string, state: InboxItem['state']): void {
    const timestamp = Date.now();
    const nextItems = this.snapshot.items.map((item) => (
      item.id === itemId
        ? {
          ...item,
          state,
          snoozedUntil: state === 'snoozed'
            ? item.snoozedUntil ?? (timestamp + 6 * 60 * 60 * 1000)
            : null,
          updatedAt: timestamp,
        }
        : item
    ));
    this.commit(nextItems, this.snapshot.lastSyncedAt);
  }

  public toggleSnooze(itemId: string, durationMs = 6 * 60 * 60 * 1000): void {
    const timestamp = Date.now();
    const nextItems = this.snapshot.items.map((item) => {
      if (item.id !== itemId) return item;
      const snoozed = isInboxItemCurrentlySnoozed(item, timestamp);
      const nextState: InboxItem['state'] = snoozed ? 'new' : 'snoozed';
      return {
        ...item,
        state: nextState,
        snoozedUntil: snoozed ? null : timestamp + durationMs,
        updatedAt: timestamp,
      };
    });
    this.commit(nextItems, this.snapshot.lastSyncedAt);
  }

  public toggleTag(itemId: string, tag: string): void {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag) return;

    const timestamp = Date.now();
    const nextItems = this.snapshot.items.map((item) => {
      if (item.id !== itemId) return item;
      const hasTag = item.tags.includes(normalizedTag);
      return {
        ...item,
        tags: hasTag
          ? item.tags.filter((entry) => entry !== normalizedTag)
          : [...item.tags, normalizedTag],
        updatedAt: timestamp,
      };
    });
    this.commit(nextItems, this.snapshot.lastSyncedAt);
  }

  public setItemFeedback(itemId: string, feedback: InboxItem['feedback']): void {
    const timestamp = Date.now();
    const nextItems = this.snapshot.items.map((item) => (
      item.id === itemId
        ? {
          ...item,
          feedback: item.feedback === feedback ? null : feedback ?? null,
          updatedAt: timestamp,
        }
        : item
    ));
    this.commit(nextItems, this.snapshot.lastSyncedAt);
  }

  public ensureWelcomeItem(workspace: Workspace): void {
    const welcomeId = `system:workspace:${workspace.id}`;
    if (this.snapshot.items.some((item) => item.id === welcomeId)) return;
    const timestamp = Date.now();
    const item: InboxItem = {
      id: welcomeId,
      kind: 'system',
      title: `${workspace.name} is ready`,
      subtitle: 'This starter workspace is tracking your current monitors, watchlist, layout, and map layers.',
      source: 'companion',
      workspaceIds: [workspace.id],
      relatedFollowIds: [],
      occurredAt: timestamp,
      state: 'new',
      tags: [],
      snoozedUntil: null,
      feedback: null,
      score: 100,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.commit(sortInboxItems([item, ...this.snapshot.items]).slice(0, MAX_INBOX_ITEMS), this.snapshot.lastSyncedAt);
  }

  public addSystemItem(input: {
    id: string;
    workspaceId: string;
    title: string;
    subtitle: string;
    score?: number;
    metadata?: Record<string, string | number | boolean | null>;
  }): void {
    if (this.snapshot.items.some((item) => item.id === input.id)) return;
    const timestamp = Date.now();
    const item: InboxItem = {
      id: input.id,
      kind: 'system',
      title: input.title,
      subtitle: input.subtitle,
      source: 'companion',
      workspaceIds: [input.workspaceId],
      relatedFollowIds: [],
      occurredAt: timestamp,
      state: 'new',
      tags: [],
      snoozedUntil: null,
      feedback: null,
      score: input.score ?? 80,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: input.metadata,
    };
    this.commit(sortInboxItems([item, ...this.snapshot.items]).slice(0, MAX_INBOX_ITEMS), this.snapshot.lastSyncedAt);
  }

  public syncFromSignals(input: InboxSyncInput): void {
    const existingById = new Map(this.snapshot.items.map((item) => [item.id, item]));
    const nextItems = new Map(existingById);
    const timestamp = Date.now();

    for (const item of input.news.slice(0, 120)) {
      const { score, followIds } = scoreNewsItem(item, input.workspace.follows);
      const id = `news:${item.link}`;
      const existing = existingById.get(id);
      nextItems.set(id, {
        id,
        kind: 'article',
        title: item.title,
        subtitle: item.source,
        source: item.source,
        url: item.link,
        workspaceIds: [input.workspace.id],
        relatedFollowIds: followIds,
        occurredAt: item.pubDate.getTime(),
        state: existing?.state ?? 'new',
        tags: existing?.tags ?? [],
        snoozedUntil: existing?.snoozedUntil ?? null,
        feedback: existing?.feedback ?? null,
        score,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        metadata: {
          isAlert: item.isAlert,
          threat: item.threat?.level ?? null,
        },
      });
    }

    for (const item of input.markets.slice(0, 60)) {
      const { score, followIds } = scoreMarketItem(item, input.workspace.follows);
      const id = `market:${item.symbol}`;
      const existing = existingById.get(id);
      nextItems.set(id, {
        id,
        kind: 'quote_move',
        title: `${item.symbol} ${item.price != null ? `$${item.price.toFixed(2)}` : 'unavailable'}`,
        subtitle: item.name,
        source: 'market',
        workspaceIds: [input.workspace.id],
        relatedFollowIds: followIds,
        occurredAt: timestamp,
        state: existing?.state ?? 'new',
        tags: existing?.tags ?? [],
        snoozedUntil: existing?.snoozedUntil ?? null,
        feedback: existing?.feedback ?? null,
        score,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        metadata: {
          symbol: item.symbol,
          change: item.change ?? null,
        },
      });
    }

    for (const item of input.predictions.slice(0, 20)) {
      const { score, followIds } = scorePredictionItem(item, input.workspace.follows);
      const id = `prediction:${item.title}`;
      const existing = existingById.get(id);
      nextItems.set(id, {
        id,
        kind: 'prediction',
        title: item.title,
        subtitle: `${Math.round(item.yesPrice)}% yes`,
        source: item.source || 'prediction',
        url: item.url,
        workspaceIds: [input.workspace.id],
        relatedFollowIds: followIds,
        occurredAt: item.endDate ? Date.parse(item.endDate) || timestamp : timestamp,
        state: existing?.state ?? 'new',
        tags: existing?.tags ?? [],
        snoozedUntil: existing?.snoozedUntil ?? null,
        feedback: existing?.feedback ?? null,
        score,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        metadata: {
          yesPrice: Math.round(item.yesPrice),
          volume: item.volume ?? null,
        },
      });
    }

    this.commit(sortInboxItems(Array.from(nextItems.values())).slice(0, MAX_INBOX_ITEMS), timestamp);
  }

  public replaceSnapshot(snapshot: { items: InboxItem[]; lastSyncedAt: number | null }): void {
    this.commit(
      sortInboxItems(snapshot.items).slice(0, MAX_INBOX_ITEMS),
      snapshot.lastSyncedAt,
    );
  }

  private commit(items: InboxItem[], lastSyncedAt: number | null): void {
    this.snapshot = {
      items: items.map(cloneInboxItem),
      lastSyncedAt,
    };
    saveInboxStoreSnapshot(this.snapshot);
    for (const listener of this.listeners) listener();
  }
}
