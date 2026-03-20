import { Panel } from './Panel';
import { formatTime } from '@/utils';
import { h, replaceChildren } from '@/utils/dom-utils';
import { t } from '@/services/i18n';
import type { AskRun, InboxItem, MemoryNote, Thread, Workspace } from '@/types';

type AskFilterId = 'all' | AskRun['intent'];

export interface CompanionAskPanelData {
  activeWorkspace: Workspace | null;
  askRuns: AskRun[];
  inboxItems: InboxItem[];
  briefs: Array<{
    id: string;
    kind: string;
    title: string;
    latestSummary?: string;
    latestGeneratedAt?: number | null;
    recentRuns: Array<{
      id: string;
      generatedAt: number;
      summary: string;
      sourceCount: number;
      status: 'ready' | 'stale';
    }>;
  }>;
  notes: MemoryNote[];
  threads: Thread[];
}

export interface CompanionAskPanelOptions {
  getData: () => CompanionAskPanelData;
  subscribe: (listener: () => void) => () => void;
  onAskWorkspace: (question: string) => void;
  onSaveAskRunAsNote: (askRunId: string) => void;
  onSaveAskRunAsAction: (askRunId: string) => void;
  onCreateThreadFromAskRun: (askRunId: string) => void;
}

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export class CompanionAskPanel extends Panel {
  private readonly options: CompanionAskPanelOptions;
  private unsubscribe: (() => void) | null = null;
  private askDraft = '';
  private activeFilter: AskFilterId = 'all';
  private selectedRunId: string | null = null;

  constructor(options: CompanionAskPanelOptions) {
    super({
      id: 'companion-ask',
      title: t('panels.companionAsk', { defaultValue: 'Companion Ask' }),
      showCount: true,
      className: 'panel-wide companion-ask-panel',
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

  private getVisibleRuns(data: CompanionAskPanelData): AskRun[] {
    return this.activeFilter === 'all'
      ? data.askRuns
      : data.askRuns.filter((run) => run.intent === this.activeFilter);
  }

  private ensureSelectedRun(visibleRuns: AskRun[]): AskRun | null {
    if (visibleRuns.length === 0) {
      this.selectedRunId = null;
      return null;
    }
    const selected = this.selectedRunId
      ? visibleRuns.find((run) => run.id === this.selectedRunId) ?? null
      : null;
    if (selected) return selected;
    const fallbackRun = visibleRuns[0] ?? null;
    this.selectedRunId = fallbackRun?.id ?? null;
    return fallbackRun;
  }

  private render(): void {
    const data = this.options.getData();
    if (!data.activeWorkspace) {
      this.setCount(0);
      replaceChildren(this.content,
        h('div', { className: 'companion-home-empty' },
          h('div', { className: 'companion-home-empty-title' }, 'No active workspace'),
          h('div', { className: 'companion-home-empty-copy' }, 'Create or activate a workspace to ask scoped questions.'),
        ),
      );
      return;
    }

    const visibleRuns = this.getVisibleRuns(data);
    const selectedRun = this.ensureSelectedRun(visibleRuns);
    this.setCount(visibleRuns.length);

    replaceChildren(this.content,
      h('div', { className: 'companion-ask-shell' },
        h('div', { className: 'companion-inbox-toolbar' },
          h('div', { className: 'companion-home-heading' },
            h('div', { className: 'companion-home-eyebrow' }, 'Workspace ask'),
            h('div', { className: 'companion-home-title' }, data.activeWorkspace.name),
            h('div', { className: 'companion-home-copy' },
              'Ask for a summary, explanation, comparison, or relevance check using current workspace context.',
            ),
          ),
        ),
        this.renderComposer(),
        h('div', { className: 'companion-inbox-filters' },
          ...[
            ['all', 'All'],
            ['general', 'General'],
            ['compare', 'Compare'],
            ['explain', 'Explain'],
            ['why', 'Why'],
          ].map(([id, label]) => (
            h('button', {
              type: 'button',
              className: `companion-inbox-filter${this.activeFilter === id ? ' active' : ''}`,
              onClick: () => {
                this.activeFilter = id as AskFilterId;
                this.render();
              },
            }, label)
          )),
        ),
        visibleRuns.length > 0
          ? h('div', { className: 'companion-ask-grid' },
            h('div', { className: 'companion-ask-list' },
              ...visibleRuns.slice(0, 14).map((run) => this.renderAskListItem(run)),
            ),
            selectedRun
              ? this.renderAskDetail(data, selectedRun)
              : h('div', { className: 'companion-home-empty-copy' }, 'Select an ask run to review it.'),
          )
          : h('div', { className: 'companion-home-empty-copy' }, 'No ask history yet. Ask the workspace a concrete question to start building research context.'),
      ),
    );
  }

  private renderComposer(): HTMLElement {
    return h('form', {
      className: 'companion-home-editor-card',
      onSubmit: (event: Event) => {
        event.preventDefault();
        this.handleAskWorkspace();
      },
    },
    h('textarea', {
      className: 'companion-home-textarea',
      placeholder: 'Ask this workspace: summarize, compare, explain, or tell me why something matters',
      onInput: (event: Event) => {
        this.askDraft = (event.target as HTMLTextAreaElement).value;
      },
    }, this.askDraft),
    h('div', { className: 'companion-home-inline-actions' },
      h('button', { type: 'submit', className: 'companion-home-action-btn' }, 'Ask Workspace'),
    ));
  }

  private renderAskListItem(run: AskRun): HTMLElement {
    const isActive = run.id === this.selectedRunId;
    return h('button', {
      type: 'button',
      className: `companion-ask-list-item${isActive ? ' active' : ''}`,
      onClick: () => {
        this.selectedRunId = run.id;
        this.render();
      },
    },
    h('div', { className: 'companion-ask-list-title' }, run.question),
    h('div', { className: 'companion-home-item-meta' },
      h('span', { className: 'companion-home-item-kind' }, humanizeToken(run.intent)),
      h('span', { className: 'companion-home-item-time' }, formatTime(new Date(run.updatedAt))),
    ),
    h('div', { className: 'companion-ask-list-preview' }, run.answer),
    );
  }

  private renderAskDetail(data: CompanionAskPanelData, run: AskRun): HTMLElement {
    const itemById = new Map(data.inboxItems.map((item) => [item.id, item.title]));
    const briefById = new Map(data.briefs.flatMap((brief) => brief.recentRuns.map((recent) => [recent.id, brief.title] as const)));
    const noteById = new Map(data.notes.map((note) => [note.id, note.title]));
    const followById = new Map((data.activeWorkspace?.follows ?? []).map((follow) => [follow.id, follow.label]));
    const threadById = new Map(data.threads.map((thread) => [thread.id, thread.title]));

    return h('article', { className: 'companion-home-section companion-ask-detail' },
      h('div', { className: 'companion-home-section-title-row' },
        h('div', { className: 'companion-home-heading' },
          h('div', { className: 'companion-home-eyebrow' }, humanizeToken(run.intent)),
          h('div', { className: 'companion-home-title' }, run.question),
        ),
        h('div', { className: 'companion-home-inline-actions' },
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.options.onCreateThreadFromAskRun(run.id),
          }, 'Thread'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.options.onSaveAskRunAsNote(run.id),
          }, 'Save Note'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.options.onSaveAskRunAsAction(run.id),
          }, 'Save Action'),
        ),
      ),
      h('div', { className: 'companion-home-note-body companion-ask-answer' }, run.answer),
      (run.citedItemIds.length > 0 || run.citedBriefRunIds.length > 0 || run.citedNoteIds.length > 0 || run.citedFollowIds.length > 0 || run.citedThreadIds.length > 0)
        ? h('div', { className: 'companion-home-editor-card companion-ask-citations' },
          h('div', { className: 'companion-home-section-title' }, 'Context Used'),
          h('div', { className: 'companion-item-tags' },
            ...run.citedItemIds.map((id) => (
              h('span', { className: 'companion-item-tag active' }, itemById.get(id) ?? 'Signal')
            )),
            ...run.citedBriefRunIds.map((id) => (
              h('span', { className: 'companion-item-tag active' }, briefById.get(id) ?? 'Brief')
            )),
            ...run.citedNoteIds.map((id) => (
              h('span', { className: 'companion-item-tag active' }, noteById.get(id) ?? 'Note')
            )),
            ...run.citedFollowIds.map((id) => (
              h('span', { className: 'companion-item-tag active' }, followById.get(id) ?? 'Follow')
            )),
            ...run.citedThreadIds.map((id) => (
              h('span', { className: 'companion-item-tag active' }, threadById.get(id) ?? 'Thread')
            )),
          ),
        )
        : h('div', { className: 'companion-home-empty-copy' }, 'This answer used only weak or implicit workspace context.'),
      h('div', { className: 'companion-home-item-time' }, `Updated ${formatTime(new Date(run.updatedAt))}`),
    );
  }

  private handleAskWorkspace(): void {
    const question = this.askDraft.trim();
    if (!question) return;
    this.selectedRunId = null;
    this.options.onAskWorkspace(question);
    this.askDraft = '';
    this.render();
  }
}
