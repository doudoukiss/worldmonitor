import type { InboxItem } from '@/types';
import { isInboxItemCurrentlySnoozed } from '@/services/inbox-store';
import { formatTime } from '@/utils';
import { h } from '@/utils/dom-utils';

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toItemKindLabel(item: InboxItem): string {
  return humanizeToken(item.kind);
}

export interface CompanionInboxItemCardOptions {
  item: InboxItem;
  compact?: boolean;
  onSetItemState: (itemId: string, state: InboxItem['state']) => void;
  onToggleSnoozeItem: (itemId: string) => void;
  onToggleItemTag: (itemId: string, tag: string) => void;
  onSetItemFeedback: (itemId: string, feedback: NonNullable<InboxItem['feedback']>) => void;
  onCreateActionFromItem: (itemId: string, title: string) => void;
  onCreateNoteFromItem: (itemId: string) => void;
  onCreateThreadFromItem: (itemId: string) => void;
}

export function renderCompanionInboxItemCard(options: CompanionInboxItemCardOptions): HTMLElement {
  const { item } = options;
  const now = Date.now();
  const snoozed = isInboxItemCurrentlySnoozed(item, now);
  const title = item.url
    ? h('a', {
      className: 'companion-home-item-title companion-home-item-link',
      href: item.url,
      target: '_blank',
      rel: 'noopener',
    }, item.title)
    : h('div', { className: 'companion-home-item-title' }, item.title);

  return h('article', {
    className: `companion-home-item companion-item-card${options.compact ? ' compact' : ''}`,
  },
  h('div', { className: 'companion-home-item-meta' },
    h('span', { className: 'companion-home-item-kind' }, toItemKindLabel(item)),
    h('span', { className: 'companion-home-item-time' }, formatTime(new Date(item.occurredAt))),
  ),
  title,
  item.subtitle
    ? h('div', { className: 'companion-home-item-subtitle' }, item.subtitle)
    : null,
  snoozed
    ? h('div', { className: 'companion-home-item-time' },
      `Snoozed until ${formatTime(new Date(item.snoozedUntil ?? now))}`,
    )
    : null,
  item.tags.length > 0
    ? h('div', { className: 'companion-item-tags' },
      ...item.tags.map((tag) => (
        h('span', { className: 'companion-item-tag active' }, humanizeToken(tag))
      )),
    )
    : null,
  h('div', { className: 'companion-home-item-actions' },
    h('button', {
      type: 'button',
      className: 'companion-home-action-btn subtle',
      onClick: () => options.onCreateNoteFromItem(item.id),
    }, 'Note'),
    h('button', {
      type: 'button',
      className: 'companion-home-action-btn subtle',
      onClick: () => options.onCreateActionFromItem(item.id, item.title),
    }, 'Task'),
    h('button', {
      type: 'button',
      className: 'companion-home-action-btn subtle',
      onClick: () => options.onCreateThreadFromItem(item.id),
    }, 'Thread'),
    h('button', {
      type: 'button',
      className: 'companion-home-action-btn',
      onClick: () => options.onSetItemState(item.id, item.state === 'saved' ? 'new' : 'saved'),
    }, item.state === 'saved' ? 'Unsave' : 'Save'),
    h('button', {
      type: 'button',
      className: 'companion-home-action-btn subtle',
      onClick: () => options.onToggleSnoozeItem(item.id),
    }, snoozed ? 'Resume' : 'Snooze'),
    h('button', {
      type: 'button',
      className: 'companion-home-action-btn subtle',
      onClick: () => options.onSetItemState(item.id, item.state === 'dismissed' ? 'new' : 'dismissed'),
    }, item.state === 'dismissed' ? 'Restore' : 'Dismiss'),
  ),
  h('div', { className: 'companion-item-tags' },
    h('button', {
      type: 'button',
      className: `companion-item-tag${item.tags.includes('watch') ? ' active' : ''}`,
      onClick: () => options.onToggleItemTag(item.id, 'watch'),
    }, 'Watch'),
    h('button', {
      type: 'button',
      className: `companion-item-tag${item.tags.includes('read_later') ? ' active' : ''}`,
      onClick: () => options.onToggleItemTag(item.id, 'read_later'),
    }, 'Read Later'),
    h('button', {
      type: 'button',
      className: `companion-item-tag${item.feedback === 'useful' ? ' active' : ''}`,
      onClick: () => options.onSetItemFeedback(item.id, 'useful'),
    }, 'Useful'),
    h('button', {
      type: 'button',
      className: `companion-item-tag${item.feedback === 'not_useful' ? ' active' : ''}`,
      onClick: () => options.onSetItemFeedback(item.id, 'not_useful'),
    }, 'Not Useful'),
    h('button', {
      type: 'button',
      className: `companion-item-tag${item.feedback === 'too_noisy' ? ' active' : ''}`,
      onClick: () => options.onSetItemFeedback(item.id, 'too_noisy'),
    }, 'Too Noisy'),
  ),
  );
}
