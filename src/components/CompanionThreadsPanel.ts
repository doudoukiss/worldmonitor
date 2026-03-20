import { Panel } from './Panel';
import { formatTime } from '@/utils';
import { h, replaceChildren } from '@/utils/dom-utils';
import { t } from '@/services/i18n';
import type { ActionItem, AskRun, InboxItem, MemoryNote, Thread, Workspace } from '@/types';

export interface CompanionThreadsPanelData {
  activeWorkspace: Workspace | null;
  threads: Thread[];
  inboxItems: InboxItem[];
  notes: MemoryNote[];
  actions: ActionItem[];
  askRuns: AskRun[];
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
}

export interface CompanionThreadsPanelOptions {
  getData: () => CompanionThreadsPanelData;
  subscribe: (listener: () => void) => () => void;
  onCreateThread: (thread: { id?: string; title: string; summary: string }) => void;
  onDeleteThread: (threadId: string) => void;
}

type ThreadFilterId = 'all' | 'active' | 'notes' | 'actions' | 'asks';

function buildThreadStats(thread: Thread): string[] {
  const stats: string[] = [];
  if (thread.linkedItemIds.length > 0) stats.push(`${thread.linkedItemIds.length} items`);
  if (thread.linkedNoteIds.length > 0) stats.push(`${thread.linkedNoteIds.length} notes`);
  if (thread.linkedActionIds.length > 0) stats.push(`${thread.linkedActionIds.length} actions`);
  if (thread.linkedAskRunIds.length > 0) stats.push(`${thread.linkedAskRunIds.length} asks`);
  if (thread.linkedBriefRunIds.length > 0) stats.push(`${thread.linkedBriefRunIds.length} briefs`);
  return stats;
}

export class CompanionThreadsPanel extends Panel {
  private readonly options: CompanionThreadsPanelOptions;
  private unsubscribe: (() => void) | null = null;
  private selectedThreadId: string | null = null;
  private activeFilter: ThreadFilterId = 'all';
  private threadEditorOpen = false;
  private editingThreadId: string | null = null;
  private threadTitleDraft = '';
  private threadSummaryDraft = '';

  constructor(options: CompanionThreadsPanelOptions) {
    super({
      id: 'companion-threads',
      title: t('panels.companionThreads', { defaultValue: 'Companion Threads' }),
      showCount: true,
      className: 'panel-wide companion-threads-panel',
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

  private getVisibleThreads(data: CompanionThreadsPanelData): Thread[] {
    switch (this.activeFilter) {
      case 'notes':
        return data.threads.filter((thread) => thread.linkedNoteIds.length > 0);
      case 'actions':
        return data.threads.filter((thread) => thread.linkedActionIds.length > 0);
      case 'asks':
        return data.threads.filter((thread) => thread.linkedAskRunIds.length > 0);
      case 'active':
        return data.threads.filter((thread) => thread.linkedItemIds.length > 0 || thread.linkedActionIds.length > 0);
      case 'all':
      default:
        return data.threads;
    }
  }

  private ensureSelectedThread(threads: Thread[]): Thread | null {
    if (threads.length === 0) {
      this.selectedThreadId = null;
      return null;
    }
    const selected = this.selectedThreadId
      ? threads.find((thread) => thread.id === this.selectedThreadId) ?? null
      : null;
    if (selected) return selected;
    const fallback = threads[0] ?? null;
    this.selectedThreadId = fallback?.id ?? null;
    return fallback;
  }

  private render(): void {
    const data = this.options.getData();
    if (!data.activeWorkspace) {
      this.setCount(0);
      replaceChildren(this.content,
        h('div', { className: 'companion-home-empty' },
          h('div', { className: 'companion-home-empty-title' }, 'No active workspace'),
          h('div', { className: 'companion-home-empty-copy' }, 'Create or activate a workspace to maintain durable threads.'),
        ),
      );
      return;
    }

    const visibleThreads = this.getVisibleThreads(data);
    const selectedThread = this.ensureSelectedThread(visibleThreads);
    this.setCount(visibleThreads.length);

    replaceChildren(this.content,
      h('div', { className: 'companion-ask-shell' },
        h('div', { className: 'companion-inbox-toolbar' },
          h('div', { className: 'companion-home-heading' },
            h('div', { className: 'companion-home-eyebrow' }, 'Workspace memory'),
            h('div', { className: 'companion-home-title' }, data.activeWorkspace.name),
            h('div', { className: 'companion-home-copy' },
              'Durable threads tie together saved items, notes, actions, ask runs, and brief context.',
            ),
          ),
          h('div', { className: 'companion-home-inline-actions' },
            h('button', {
              type: 'button',
              className: 'companion-home-action-btn',
              onClick: () => this.openThreadEditor(),
            }, this.threadEditorOpen && this.editingThreadId === null ? 'Close' : 'New Thread'),
          ),
        ),
        this.threadEditorOpen
          ? this.renderThreadEditor()
          : null,
        h('div', { className: 'companion-inbox-filters' },
          ...[
            ['all', 'All'],
            ['active', 'Active'],
            ['notes', 'Notes'],
            ['actions', 'Actions'],
            ['asks', 'Asks'],
          ].map(([id, label]) => (
            h('button', {
              type: 'button',
              className: `companion-inbox-filter${this.activeFilter === id ? ' active' : ''}`,
              onClick: () => {
                this.activeFilter = id as ThreadFilterId;
                this.render();
              },
            }, label)
          )),
        ),
        visibleThreads.length > 0
          ? h('div', { className: 'companion-ask-grid' },
            h('div', { className: 'companion-ask-list' },
              ...visibleThreads.slice(0, 16).map((thread) => this.renderThreadListItem(thread)),
            ),
            selectedThread
              ? this.renderThreadDetail(data, selectedThread)
              : h('div', { className: 'companion-home-empty-copy' }, 'Select a thread to review it.'),
          )
          : h('div', { className: 'companion-home-empty-copy' }, 'No threads yet. Create one from a note, action, ask run, inbox item, or directly from this panel.'),
      ),
    );
  }

  private renderThreadListItem(thread: Thread): HTMLElement {
    const isActive = thread.id === this.selectedThreadId;
    return h('button', {
      type: 'button',
      className: `companion-ask-list-item${isActive ? ' active' : ''}`,
      onClick: () => {
        this.selectedThreadId = thread.id;
        this.render();
      },
    },
    h('div', { className: 'companion-ask-list-title' }, thread.title),
    h('div', { className: 'companion-home-item-meta' },
      h('span', { className: 'companion-home-item-kind' }, 'Thread'),
      h('span', { className: 'companion-home-item-time' }, formatTime(new Date(thread.updatedAt))),
    ),
    h('div', { className: 'companion-ask-list-preview' }, thread.summary),
    );
  }

  private renderThreadDetail(data: CompanionThreadsPanelData, thread: Thread): HTMLElement {
    const linkedItems = data.inboxItems.filter((item) => thread.linkedItemIds.includes(item.id)).slice(0, 5);
    const linkedNotes = data.notes.filter((note) => thread.linkedNoteIds.includes(note.id)).slice(0, 4);
    const linkedActions = data.actions.filter((action) => thread.linkedActionIds.includes(action.id)).slice(0, 4);
    const linkedAskRuns = data.askRuns.filter((run) => thread.linkedAskRunIds.includes(run.id)).slice(0, 3);
    const linkedBriefs = data.briefs
      .flatMap((brief) => brief.recentRuns.map((run) => ({ title: brief.title, run })))
      .filter((entry) => thread.linkedBriefRunIds.includes(entry.run.id))
      .slice(0, 3);

    const timeline = [
      ...linkedItems.map((item) => ({
        kind: 'item',
        title: item.title,
        detail: item.subtitle || item.source,
        time: item.occurredAt,
      })),
      ...linkedNotes.map((note) => ({
        kind: 'note',
        title: note.title,
        detail: note.body,
        time: note.updatedAt,
      })),
      ...linkedActions.map((action) => ({
        kind: 'action',
        title: action.title,
        detail: action.status === 'done' ? 'Completed action' : 'Open action',
        time: action.updatedAt,
      })),
      ...linkedAskRuns.map((run) => ({
        kind: 'ask',
        title: run.question,
        detail: run.answer,
        time: run.updatedAt,
      })),
      ...linkedBriefs.map((entry) => ({
        kind: 'brief',
        title: entry.title,
        detail: entry.run.summary,
        time: entry.run.generatedAt,
      })),
    ].sort((a, b) => b.time - a.time).slice(0, 8);

    return h('article', { className: 'companion-home-section companion-ask-detail' },
      h('div', { className: 'companion-home-section-title-row' },
        h('div', { className: 'companion-home-heading' },
          h('div', { className: 'companion-home-eyebrow' }, 'Thread detail'),
          h('div', { className: 'companion-home-title' }, thread.title),
        ),
        h('div', { className: 'companion-home-inline-actions' },
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.openThreadEditor(thread),
          }, 'Edit'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.options.onDeleteThread(thread.id),
          }, 'Delete'),
        ),
      ),
      h('div', { className: 'companion-home-note-body companion-ask-answer' }, thread.summary),
      h('div', { className: 'companion-item-tags' },
        ...buildThreadStats(thread).map((stat) => (
          h('span', { className: 'companion-item-tag active' }, stat)
        )),
      ),
      timeline.length > 0
        ? h('div', { className: 'companion-home-editor-card companion-ask-citations' },
          h('div', { className: 'companion-home-section-title' }, 'What Changed In This Thread'),
          ...timeline.map((entry) => (
            h('div', { className: 'companion-threads-timeline-item' },
              h('div', { className: 'companion-home-item-meta' },
                h('span', { className: 'companion-home-item-kind' }, entry.kind),
                h('span', { className: 'companion-home-item-time' }, formatTime(new Date(entry.time))),
              ),
              h('div', { className: 'companion-ask-list-title' }, entry.title),
              h('div', { className: 'companion-ask-list-preview' }, entry.detail),
            )
          )),
        )
        : h('div', { className: 'companion-home-empty-copy' }, 'This thread has not accumulated linked activity yet.'),
    );
  }

  private renderThreadEditor(): HTMLElement {
    const isEditing = this.editingThreadId !== null;
    return h('form', {
      className: 'companion-home-editor-card',
      onSubmit: (event: Event) => {
        event.preventDefault();
        this.handleSaveThread();
      },
    },
    h('input', {
      className: 'companion-home-input',
      value: this.threadTitleDraft,
      placeholder: 'Thread title',
      onInput: (event: Event) => {
        this.threadTitleDraft = (event.target as HTMLInputElement).value;
      },
    }),
    h('textarea', {
      className: 'companion-home-textarea',
      placeholder: 'Why this thread matters',
      onInput: (event: Event) => {
        this.threadSummaryDraft = (event.target as HTMLTextAreaElement).value;
      },
    }, this.threadSummaryDraft),
    h('div', { className: 'companion-home-inline-actions' },
      h('button', { type: 'submit', className: 'companion-home-action-btn' }, isEditing ? 'Update Thread' : 'Save Thread'),
      h('button', {
        type: 'button',
        className: 'companion-home-action-btn subtle',
        onClick: () => this.closeThreadEditor(),
      }, 'Cancel'),
    ));
  }

  private handleSaveThread(): void {
    const title = this.threadTitleDraft.trim();
    const summary = this.threadSummaryDraft.trim();
    if (!title || !summary) return;
    this.options.onCreateThread({
      id: this.editingThreadId ?? undefined,
      title,
      summary,
    });
    this.closeThreadEditor();
  }

  private openThreadEditor(thread?: Thread): void {
    this.threadEditorOpen = true;
    this.editingThreadId = thread?.id ?? null;
    this.threadTitleDraft = thread?.title ?? '';
    this.threadSummaryDraft = thread?.summary ?? '';
    this.render();
  }

  private closeThreadEditor(): void {
    this.threadEditorOpen = false;
    this.editingThreadId = null;
    this.threadTitleDraft = '';
    this.threadSummaryDraft = '';
    this.render();
  }
}
