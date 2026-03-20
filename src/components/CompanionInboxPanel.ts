import { Panel } from './Panel';
import { renderCompanionInboxItemCard } from './CompanionInboxItemCard';
import { isInboxItemCurrentlySnoozed } from '@/services/inbox-store';
import { t } from '@/services/i18n';
import { h, replaceChildren } from '@/utils/dom-utils';
import type { InboxItem, Workspace } from '@/types';

type InboxFilterId = 'active' | 'new' | 'saved' | 'snoozed' | 'dismissed' | 'alerts';

export interface CompanionInboxPanelData {
  activeWorkspace: Workspace | null;
  inboxItems: InboxItem[];
  newSincePreviousVisit: number;
}

export interface CompanionInboxPanelOptions {
  getData: () => CompanionInboxPanelData;
  subscribe: (listener: () => void) => () => void;
  onSetItemState: (itemId: string, state: InboxItem['state']) => void;
  onToggleSnoozeItem: (itemId: string) => void;
  onToggleItemTag: (itemId: string, tag: string) => void;
  onSetItemFeedback: (itemId: string, feedback: NonNullable<InboxItem['feedback']>) => void;
  onCreateActionFromItem: (itemId: string, title: string) => void;
  onCreateNoteFromItem: (itemId: string) => void;
  onCreateThreadFromItem: (itemId: string) => void;
}

export class CompanionInboxPanel extends Panel {
  private readonly options: CompanionInboxPanelOptions;
  private unsubscribe: (() => void) | null = null;
  private activeFilter: InboxFilterId = 'active';

  constructor(options: CompanionInboxPanelOptions) {
    super({
      id: 'companion-inbox',
      title: t('panels.companionInbox', { defaultValue: 'Companion Inbox' }),
      showCount: true,
      className: 'panel-wide companion-inbox-panel',
      defaultRowSpan: 3,
    });
    this.options = options;
    this.unsubscribe = this.options.subscribe(() => this.render());
    this.render();
  }

  public override destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.destroy();
  }

  private filterItems(items: InboxItem[]): InboxItem[] {
    switch (this.activeFilter) {
      case 'new':
        return items.filter((item) => item.state === 'new');
      case 'saved':
        return items.filter((item) => item.state === 'saved');
      case 'snoozed':
        return items.filter((item) => isInboxItemCurrentlySnoozed(item));
      case 'dismissed':
        return items.filter((item) => item.state === 'dismissed');
      case 'alerts':
        return items.filter((item) => item.metadata?.isAlert === true && item.state !== 'dismissed');
      case 'active':
      default:
        return items.filter((item) => item.state !== 'dismissed' && !isInboxItemCurrentlySnoozed(item));
    }
  }

  private render(): void {
    const data = this.options.getData();
    if (!data.activeWorkspace) {
      this.setCount(0);
      replaceChildren(this.content,
        h('div', { className: 'companion-home-empty' },
          h('div', { className: 'companion-home-empty-title' }, 'No active workspace'),
          h('div', { className: 'companion-home-empty-copy' }, 'Create or activate a workspace to open the companion inbox.'),
        ),
      );
      return;
    }

    const filteredItems = this.filterItems(data.inboxItems).slice(0, 24);
    this.setCount(filteredItems.length);

    replaceChildren(this.content,
      h('div', { className: 'companion-inbox-shell' },
        h('div', { className: 'companion-inbox-toolbar' },
          h('div', { className: 'companion-home-heading' },
            h('div', { className: 'companion-home-eyebrow' }, 'Unified inbox'),
            h('div', { className: 'companion-home-title' }, data.activeWorkspace.name),
            h('div', { className: 'companion-home-copy' },
              `${data.newSincePreviousVisit} new since the previous visit across news, markets, and alerts.`,
            ),
          ),
          h('div', { className: 'companion-inbox-filters' },
            ...[
              ['active', 'Active'],
              ['new', 'New'],
              ['saved', 'Saved'],
              ['snoozed', 'Snoozed'],
              ['alerts', 'Alerts'],
              ['dismissed', 'Dismissed'],
            ].map(([id, label]) => (
              h('button', {
                type: 'button',
                className: `companion-inbox-filter${this.activeFilter === id ? ' active' : ''}`,
                onClick: () => {
                  this.activeFilter = id as InboxFilterId;
                  this.render();
                },
              }, label)
            )),
          ),
        ),
        filteredItems.length > 0
          ? h('div', { className: 'companion-inbox-list' },
            ...filteredItems.map((item) => renderCompanionInboxItemCard({
              item,
              onSetItemState: this.options.onSetItemState,
              onToggleSnoozeItem: this.options.onToggleSnoozeItem,
              onToggleItemTag: this.options.onToggleItemTag,
              onSetItemFeedback: this.options.onSetItemFeedback,
              onCreateActionFromItem: this.options.onCreateActionFromItem,
              onCreateNoteFromItem: this.options.onCreateNoteFromItem,
              onCreateThreadFromItem: this.options.onCreateThreadFromItem,
            })),
          )
          : h('div', { className: 'companion-home-empty-copy' }, 'No items match this inbox filter yet.'),
      ),
    );
  }
}
