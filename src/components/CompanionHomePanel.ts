import { Panel } from './Panel';
import { renderCompanionInboxItemCard } from './CompanionInboxItemCard';
import { isInboxItemCurrentlySnoozed } from '@/services/inbox-store';
import { t } from '@/services/i18n';
import { formatTime } from '@/utils';
import { fragment, h, replaceChildren } from '@/utils/dom-utils';
import type { CompanionSyncComparison, CompanionSyncReadinessCheck, CompanionSyncRecommendation } from '@/services/companion-sync';
import type { ActionItem, AskRun, AutomationEvent, AutomationRule, Follow, InboxItem, MemoryNote, SyncJob, Thread, Workspace } from '@/types';

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toWorkspaceLabel(workspace: Workspace): string {
  return workspace.template === 'custom'
    ? 'Custom'
    : humanizeToken(workspace.template);
}

function toDuePreset(dueAt: number | null | undefined): string {
  if (typeof dueAt !== 'number') return 'none';
  const diff = dueAt - Date.now();
  if (diff <= 3 * 60 * 60 * 1000) return 'today';
  if (diff <= 36 * 60 * 60 * 1000) return 'tomorrow';
  return 'next_week';
}

function toDueAt(preset: string): number | null {
  const now = Date.now();
  switch (preset) {
    case 'today':
      return now + 4 * 60 * 60 * 1000;
    case 'tomorrow':
      return now + 24 * 60 * 60 * 1000;
    case 'next_week':
      return now + 7 * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

function copyText(value: string): void {
  if (!value) return;
  void navigator.clipboard?.writeText(value);
}

export interface CompanionHomePanelData {
  profileName: string;
  profileSyncMode: 'local' | 'sync';
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  inboxItems: InboxItem[];
  unreadCount: number;
  savedCount: number;
  newSincePreviousVisit: number;
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
  actions: ActionItem[];
  notes: MemoryNote[];
  threads: Thread[];
  automationRules: AutomationRule[];
  automationHistory: AutomationEvent[];
  syncJobs: SyncJob[];
  syncStatus: {
    provider: 'none' | 'manual' | 'convex';
    providerAvailable: boolean;
    syncChannel: string;
    installationId: string;
    suggestedChannel: string;
    readinessChecks: CompanionSyncReadinessCheck[];
    comparison: CompanionSyncComparison;
    recommendation: CompanionSyncRecommendation;
    lastProbedAt: number | null;
    lastExportedAt: number | null;
    lastImportedAt: number | null;
    lastPushedAt: number | null;
    lastPulledAt: number | null;
    lastFingerprint: string | null;
    remoteExportedAt: number | null;
    remoteUpdatedAt: number | null;
    remoteFingerprint: string | null;
    remoteInstallationId: string | null;
    lastConflictAt: number | null;
    lastConflictFingerprint: string | null;
    lastError: string | null;
    convexUrlConfigured: boolean;
  };
  availableFeatureIds: string[];
}

export interface CompanionHomePanelOptions {
  getData: () => CompanionHomePanelData;
  subscribe: (listener: () => void) => () => void;
  onCreateWorkspace: (name: string) => void;
  onActivateWorkspace: (workspaceId: string) => void;
  onUpdateWorkspace: (workspace: { id: string; name: string; description: string }) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onSetItemState: (itemId: string, state: InboxItem['state']) => void;
  onToggleSnoozeItem: (itemId: string) => void;
  onToggleItemTag: (itemId: string, tag: string) => void;
  onSetItemFeedback: (itemId: string, feedback: NonNullable<InboxItem['feedback']>) => void;
  onAskWorkspace: (question: string) => void;
  onGenerateBrief: (recipeId: string) => void;
  onAddFollow: (label: string, query: string) => void;
  onRemoveFollow: (followId: string) => void;
  onSaveNote: (note: { id?: string; title: string; body: string; linkedFollowIds: string[] }) => void;
  onCreateThread: (thread: { id?: string; title: string; summary: string }) => void;
  onDeleteThread: (threadId: string) => void;
  onCreateThreadFromNote: (noteId: string) => void;
  onCreateNoteFromItem: (itemId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onSaveAskRunAsNote: (askRunId: string) => void;
  onRenameProfile: (name: string) => void;
  onSetSyncMode: (mode: 'local' | 'sync') => void;
  onSaveAction: (action: { id?: string; title: string; dueAt: number | null }) => void;
  onSaveAskRunAsAction: (askRunId: string) => void;
  onCreateActionFromItem: (itemId: string, title: string) => void;
  onCreateThreadFromItem: (itemId: string) => void;
  onCreateThreadFromAction: (actionId: string) => void;
  onCreateThreadFromAskRun: (askRunId: string) => void;
  onDeleteAction: (actionId: string) => void;
  onToggleAction: (actionId: string, nextStatus: ActionItem['status']) => void;
  onSaveAutomationRule: (rule: {
    id?: string;
    name: string;
    trigger: AutomationRule['trigger'];
    action: AutomationRule['action'];
    minimumScore: number;
  }) => void;
  onDeleteAutomationRule: (ruleId: string) => void;
  onToggleAutomationRule: (ruleId: string, enabled: boolean) => void;
  onSnoozeAutomationRule: (ruleId: string) => void;
  onResumeAutomationRule: (ruleId: string) => void;
  onExportBackup: () => void;
  onImportBackup: (raw: string) => void;
  onSetSyncProvider: (provider: 'none' | 'manual' | 'convex') => void;
  onSetSyncChannel: (syncChannel: string) => void | Promise<void>;
  onProbeSync: () => void | Promise<void>;
  onPushSync: () => void | Promise<void>;
  onForcePushSync: () => void | Promise<void>;
  onPullSync: () => void | Promise<void>;
  onResetSyncDiagnostics: () => void;
}

export class CompanionHomePanel extends Panel {
  private readonly options: CompanionHomePanelOptions;
  private unsubscribe: (() => void) | null = null;
  private profileEditorOpen = false;
  private profileDraft = '';
  private followComposerOpen = false;
  private followLabelDraft = '';
  private followQueryDraft = '';
  private askDraft = '';
  private workspaceEditorOpen = false;
  private workspaceNameDraft = '';
  private workspaceDescriptionDraft = '';
  private noteEditorOpen = false;
  private editingNoteId: string | null = null;
  private noteTitleDraft = '';
  private noteBodyDraft = '';
  private noteLinkedFollowIdsDraft: string[] = [];
  private threadEditorOpen = false;
  private editingThreadId: string | null = null;
  private threadTitleDraft = '';
  private threadSummaryDraft = '';
  private actionEditorOpen = false;
  private editingActionId: string | null = null;
  private actionTitleDraft = '';
  private actionDuePreset = 'none';
  private automationEditorOpen = false;
  private editingAutomationRuleId: string | null = null;
  private automationNameDraft = '';
  private automationTriggerDraft: AutomationRule['trigger'] = 'high_priority_item';
  private automationActionDraft: AutomationRule['action'] = 'in_app';
  private automationMinimumScoreDraft = '70';
  private syncChannelDraft = '';
  private readonly importInput: HTMLInputElement;

  constructor(options: CompanionHomePanelOptions) {
    super({
      id: 'companion-home',
      title: t('panels.companionHome', { defaultValue: 'Companion Home' }),
      showCount: true,
      className: 'panel-wide companion-home-panel',
      defaultRowSpan: 2,
    });
    this.options = options;
    this.importInput = h('input', {
      type: 'file',
      accept: 'application/json,.json',
      style: 'display:none',
      onChange: (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const raw = typeof reader.result === 'string' ? reader.result : '';
          if (raw) this.options.onImportBackup(raw);
          this.importInput.value = '';
        };
        reader.readAsText(file);
      },
    }) as HTMLInputElement;
    this.unsubscribe = this.options.subscribe(() => this.render());
    this.render();
  }

  public override destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.destroy();
  }

  private render(): void {
    const data = this.options.getData();
    this.setCount(data.unreadCount);

    if (!data.activeWorkspace) {
      replaceChildren(this.content,
        h('div', { className: 'companion-home-empty' },
          h('div', { className: 'companion-home-empty-title' }, 'No active workspace'),
          h('div', { className: 'companion-home-empty-copy' }, 'Create a workspace to start collecting personal signals.'),
        ),
      );
      return;
    }

    const activeWorkspace = data.activeWorkspace;
    if (!this.syncChannelDraft && data.syncStatus.syncChannel) {
      this.syncChannelDraft = data.syncStatus.syncChannel;
    }

    const visibleItems = data.inboxItems
      .filter((item) => item.state !== 'dismissed' && !isInboxItemCurrentlySnoozed(item))
      .slice(0, 6);

    replaceChildren(this.content,
      h('div', { className: 'companion-home-shell' },
        h('div', { className: 'companion-home-topbar' },
          h('div', { className: 'companion-home-heading' },
            h('div', { className: 'companion-home-profile-row' },
              this.profileEditorOpen
                ? h('form', {
                  className: 'companion-home-inline-form companion-home-inline-form-profile',
                  onSubmit: (event: Event) => {
                    event.preventDefault();
                    this.handleRenameProfile();
                  },
                },
                h('input', {
                  className: 'companion-home-input',
                  value: this.profileDraft,
                  placeholder: 'Profile name',
                  onInput: (event: Event) => {
                    this.profileDraft = (event.target as HTMLInputElement).value;
                  },
                }),
                h('div', { className: 'companion-home-inline-actions' },
                  h('button', { type: 'submit', className: 'companion-home-action-btn' }, 'Save'),
                  h('button', {
                    type: 'button',
                    className: 'companion-home-action-btn subtle',
                    onClick: () => this.closeProfileEditor(),
                  }, 'Cancel'),
                ),
              )
                : fragment(
                  h('div', { className: 'companion-home-profile-name' }, data.profileName),
                  h('button', {
                    type: 'button',
                    className: `companion-home-action-btn subtle${data.profileSyncMode === 'local' ? ' active' : ''}`,
                    onClick: () => this.options.onSetSyncMode('local'),
                  }, 'Local'),
                  h('button', {
                    type: 'button',
                    className: `companion-home-action-btn subtle${data.profileSyncMode === 'sync' ? ' active' : ''}`,
                    onClick: () => this.options.onSetSyncMode('sync'),
                  }, 'Sync Ready'),
                  h('button', {
                    type: 'button',
                    className: 'companion-home-action-btn subtle',
                    onClick: () => this.openProfileEditor(data.profileName),
                  }, 'Rename'),
                ),
            ),
            h('div', { className: 'companion-home-eyebrow' }, `${toWorkspaceLabel(activeWorkspace)} workspace`),
            h('div', { className: 'companion-home-title' }, activeWorkspace.name),
            h('div', { className: 'companion-home-copy' },
              activeWorkspace.description || 'Personal inbox, follows, and brief recipes layered onto the current dashboard.',
            ),
          ),
          h('div', { className: 'companion-home-inline-actions' },
            h('button', {
              type: 'button',
              className: 'companion-home-action-btn subtle',
              onClick: () => this.options.onExportBackup(),
            }, 'Export'),
            h('button', {
              type: 'button',
              className: 'companion-home-action-btn subtle',
              onClick: () => this.importInput.click(),
            }, 'Import'),
            h('button', {
              type: 'button',
              className: 'companion-home-action-btn subtle',
              onClick: () => this.openWorkspaceEditor(activeWorkspace),
            }, this.workspaceEditorOpen ? 'Close Edit' : 'Edit'),
            h('button', {
              type: 'button',
              className: 'companion-home-create-btn',
              onClick: () => this.handleCreateWorkspace(),
            }, 'New Workspace'),
          ),
        ),
        this.importInput,
        this.workspaceEditorOpen
          ? this.renderWorkspaceEditor(activeWorkspace)
          : null,
        h('div', { className: 'companion-home-stats' },
          this.renderStatCard('New since last visit', String(data.newSincePreviousVisit)),
          this.renderStatCard('Saved', String(data.savedCount)),
          this.renderStatCard('Follows', String(activeWorkspace.follows.length)),
          this.renderStatCard('Capabilities', String(data.availableFeatureIds.length)),
        ),
        h('div', { className: 'companion-home-grid' },
          h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title' }, 'Workspaces'),
            h('div', { className: 'companion-home-workspaces' },
              ...data.workspaces.slice(0, 6).map((workspace) => (
                h('button', {
                  type: 'button',
                  className: `companion-home-workspace-btn${workspace.id === activeWorkspace.id ? ' active' : ''}`,
                  onClick: () => this.options.onActivateWorkspace(workspace.id),
                },
                  h('span', { className: 'companion-home-workspace-name' }, workspace.name),
                  h('span', { className: 'companion-home-workspace-meta' },
                    `${workspace.follows.length} follows`,
                  ),
                )
              )),
            ),
          ),
          h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title-row' },
              h('div', { className: 'companion-home-section-title' }, 'Follows'),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn',
                onClick: () => this.openFollowComposer(),
              }, this.followComposerOpen ? 'Close' : 'Add'),
            ),
            this.followComposerOpen
              ? this.renderFollowComposer()
              : null,
            activeWorkspace.follows.length > 0
              ? h('div', { className: 'companion-home-follow-list' },
                ...activeWorkspace.follows.slice(0, 10).map((follow) => (
                  this.renderFollowChip(follow)
                )),
              )
              : h('div', { className: 'companion-home-empty-copy' }, 'Your current monitors and watchlist will appear here.'),
          ),
          h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title' }, 'Ask Workspace'),
            this.renderAskComposer(),
            data.askRuns.length > 0
              ? h('div', { className: 'companion-home-note-list' },
                ...data.askRuns.slice(0, 6).map((run) => this.renderAskRun(run)),
              )
              : h('div', { className: 'companion-home-empty-copy' }, 'Ask a scoped question about this workspace and save the answer into notes or actions.'),
          ),
          h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title' }, 'Brief Recipes'),
            data.briefs.length > 0
              ? h('div', { className: 'companion-home-brief-list' },
                ...data.briefs.map((brief) => (
                  h('div', { className: 'companion-home-brief-item-card' },
                    h('div', { className: 'companion-home-brief-item-header' },
                      h('div', { className: 'companion-home-brief-item-title' }, brief.title),
                      h('button', {
                        type: 'button',
                        className: 'companion-home-action-btn',
                        onClick: () => this.options.onGenerateBrief(brief.id),
                      }, 'Run'),
                    ),
                    brief.latestSummary
                      ? h('div', { className: 'companion-home-brief-item-summary' }, brief.latestSummary)
                      : h('div', { className: 'companion-home-empty-copy' }, 'No run stored yet.'),
                    brief.latestGeneratedAt
                      ? h('div', { className: 'companion-home-item-time' }, formatTime(new Date(brief.latestGeneratedAt)))
                      : null,
                    brief.recentRuns.length > 0
                      ? h('div', { className: 'companion-home-brief-run-list' },
                        ...brief.recentRuns.map((run) => (
                          h('div', { className: 'companion-home-brief-run-card' },
                            h('div', { className: 'companion-home-brief-run-header' },
                              h('span', { className: 'companion-home-item-time' }, formatTime(new Date(run.generatedAt))),
                              h('span', { className: 'companion-home-item-kind' }, `${run.sourceCount} items`),
                            ),
                            h('div', { className: 'companion-home-brief-run-summary' }, run.summary),
                          )
                        )),
                      )
                      : null,
                  )
                )),
              )
              : h('div', { className: 'companion-home-empty-copy' }, 'Morning and delta briefs will appear here as recipes are added.'),
          ),
        h('section', { className: 'companion-home-section' },
          h('div', { className: 'companion-home-section-title' }, 'Available Features'),
            data.availableFeatureIds.length > 0
              ? h('div', { className: 'companion-home-feature-list' },
                ...data.availableFeatureIds.slice(0, 8).map((featureId) => (
                  h('span', { className: 'companion-home-feature-chip' }, humanizeToken(featureId))
                )),
              )
              : h('div', { className: 'companion-home-empty-copy' }, 'Running in local-only mode with no feature unlocks detected yet.'),
          ),
          h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title' }, 'Sync Status'),
            h('div', { className: 'companion-home-note-body' },
              data.profileSyncMode === 'local'
                ? 'Local-only mode is active. Export/import remains available.'
                : `Sync-ready mode is active via ${data.syncStatus.provider === 'convex' ? 'Convex remote sync' : data.syncStatus.provider === 'manual' ? 'manual backup' : 'local-only'} transport.`,
            ),
            h('div', { className: 'companion-home-inline-actions' },
              h('button', {
                type: 'button',
                className: `companion-home-action-btn subtle${data.syncStatus.provider === 'none' ? ' active' : ''}`,
                onClick: () => this.options.onSetSyncProvider('none'),
              }, 'Local'),
              h('button', {
                type: 'button',
                className: `companion-home-action-btn subtle${data.syncStatus.provider === 'manual' ? ' active' : ''}`,
                onClick: () => this.options.onSetSyncProvider('manual'),
              }, 'Manual'),
              h('button', {
                type: 'button',
                className: `companion-home-action-btn subtle${data.syncStatus.provider === 'convex' ? ' active' : ''}`,
                disabled: !data.syncStatus.convexUrlConfigured,
                onClick: () => this.options.onSetSyncProvider('convex'),
              }, 'Convex'),
            ),
            data.profileSyncMode === 'sync' && data.syncStatus.provider === 'convex'
              ? h('form', {
                className: 'companion-home-inline-form',
                onSubmit: (event: Event) => {
                  event.preventDefault();
                  this.syncChannelDraft = this.syncChannelDraft.trim().toLowerCase();
                  void this.options.onSetSyncChannel(this.syncChannelDraft);
                },
              },
              h('input', {
                className: 'companion-home-input',
                value: this.syncChannelDraft,
                placeholder: 'Sync channel',
                onInput: (event: Event) => {
                  this.syncChannelDraft = (event.target as HTMLInputElement).value;
                },
              }),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn subtle',
                onClick: () => {
                  this.syncChannelDraft = data.syncStatus.suggestedChannel;
                  this.render();
                },
              }, 'Use Suggested'),
              h('button', {
                type: 'submit',
                className: 'companion-home-action-btn subtle',
              }, 'Save Channel'),
              )
              : null,
            h('div', { className: 'companion-home-inline-actions' },
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn subtle',
                disabled: data.profileSyncMode !== 'sync'
                  || data.syncStatus.provider !== 'convex'
                  || !data.syncStatus.providerAvailable
                  || !data.syncStatus.syncChannel,
                onClick: () => {
                  void this.options.onProbeSync();
                },
              }, 'Check Remote'),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn subtle',
                disabled: data.profileSyncMode !== 'sync'
                  || (data.syncStatus.provider === 'manual'
                    ? false
                    : data.syncStatus.provider === 'convex'
                      ? !data.syncStatus.providerAvailable || !data.syncStatus.syncChannel
                      : true),
                onClick: () => {
                  void this.options.onPushSync();
                },
              }, 'Push'),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn subtle',
                disabled: data.profileSyncMode !== 'sync'
                  || (data.syncStatus.provider === 'manual'
                    ? false
                    : data.syncStatus.provider === 'convex'
                      ? !data.syncStatus.providerAvailable || !data.syncStatus.syncChannel
                      : true),
                onClick: () => {
                  void this.options.onPullSync();
                },
              }, 'Pull'),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn subtle',
                disabled: data.profileSyncMode !== 'sync'
                  || data.syncStatus.provider !== 'convex'
                  || !data.syncStatus.syncChannel
                  || !data.syncStatus.lastConflictAt,
                onClick: () => {
                  void this.options.onForcePushSync();
                },
              }, 'Force Push'),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn subtle',
                onClick: () => this.options.onResetSyncDiagnostics(),
              }, 'Reset Status'),
            ),
            data.syncStatus.provider === 'convex' && !data.syncStatus.convexUrlConfigured
              ? h('div', { className: 'companion-home-item-time' }, 'Convex remote sync is unavailable until VITE_CONVEX_URL is configured.')
              : null,
            data.syncStatus.provider === 'convex' && data.syncStatus.convexUrlConfigured
              ? h('div', { className: 'companion-home-item-time' }, 'Setup: deploy Convex schema/functions, set VITE_CONVEX_URL, choose one shared sync channel on every install, then push from one device and pull from the other.')
              : null,
            h('div', { className: 'companion-home-note-body' }, `${data.syncStatus.recommendation.label}: ${data.syncStatus.recommendation.detail}`),
            h('div', { className: 'companion-home-note-body' }, data.syncStatus.comparison.summary),
            h('div', { className: 'companion-home-brief-run-list' },
              ...data.syncStatus.readinessChecks.map((check) => (
                h('div', { className: 'companion-home-brief-run-card' },
                  h('div', { className: 'companion-home-brief-run-header' },
                    h('span', { className: 'companion-home-item-kind' }, `${check.ok ? 'Ready' : 'Needs Setup'}`),
                    h('span', { className: 'companion-home-item-time' }, check.label),
                  ),
                  h('div', { className: 'companion-home-brief-run-summary' }, check.detail),
                )
              )),
            ),
            data.syncStatus.provider === 'convex' && data.syncStatus.syncChannel
              ? h('div', { className: 'companion-home-inline-actions' },
                h('div', { className: 'companion-home-item-time' }, `Channel ${data.syncStatus.syncChannel}`),
                h('button', {
                  type: 'button',
                  className: 'companion-home-action-btn subtle',
                  onClick: () => copyText(data.syncStatus.syncChannel),
                }, 'Copy Channel'),
              )
              : null,
            data.syncStatus.provider === 'convex' && !data.syncStatus.syncChannel
              ? h('div', { className: 'companion-home-item-time' }, `Suggested channel ${data.syncStatus.suggestedChannel}`)
              : null,
            data.syncStatus.provider === 'convex'
              ? h('div', { className: 'companion-home-inline-actions' },
                h('div', { className: 'companion-home-item-time' }, `Install ${data.syncStatus.installationId}`),
                h('button', {
                  type: 'button',
                  className: 'companion-home-action-btn subtle',
                  onClick: () => copyText(data.syncStatus.installationId),
                }, 'Copy Install'),
              )
              : null,
            data.syncStatus.lastProbedAt
              ? h('div', { className: 'companion-home-item-time' }, `Last remote check ${formatTime(new Date(data.syncStatus.lastProbedAt))}`)
              : null,
            data.syncStatus.lastExportedAt
              ? h('div', { className: 'companion-home-item-time' }, `Last export ${formatTime(new Date(data.syncStatus.lastExportedAt))}`)
              : null,
            data.syncStatus.lastImportedAt
              ? h('div', { className: 'companion-home-item-time' }, `Last import ${formatTime(new Date(data.syncStatus.lastImportedAt))}`)
              : null,
            data.syncStatus.lastPushedAt
              ? h('div', { className: 'companion-home-item-time' }, `Last push ${formatTime(new Date(data.syncStatus.lastPushedAt))}`)
              : null,
            data.syncStatus.lastPulledAt
              ? h('div', { className: 'companion-home-item-time' }, `Last pull ${formatTime(new Date(data.syncStatus.lastPulledAt))}`)
              : null,
            data.syncStatus.lastFingerprint
              ? h('div', { className: 'companion-home-item-time' }, `Snapshot ${data.syncStatus.lastFingerprint}`)
              : null,
            data.syncStatus.remoteUpdatedAt
              ? h('div', { className: 'companion-home-item-time' }, `Remote update ${formatTime(new Date(data.syncStatus.remoteUpdatedAt))}`)
              : null,
            data.syncStatus.remoteExportedAt
              ? h('div', { className: 'companion-home-item-time' }, `Remote export ${formatTime(new Date(data.syncStatus.remoteExportedAt))}`)
              : null,
            data.syncStatus.remoteFingerprint
              ? h('div', { className: 'companion-home-item-time' }, `Remote snapshot ${data.syncStatus.remoteFingerprint}`)
              : null,
            data.syncStatus.remoteInstallationId
              ? h('div', { className: 'companion-home-inline-actions' },
                h('div', { className: 'companion-home-item-time' }, `Remote written by ${data.syncStatus.remoteInstallationId}`),
                h('button', {
                  type: 'button',
                  className: 'companion-home-action-btn subtle',
                  onClick: () => copyText(data.syncStatus.remoteInstallationId ?? ''),
                }, 'Copy Remote'),
              )
              : null,
            data.syncStatus.lastConflictAt
              ? h('div', { className: 'companion-home-item-time' }, `Conflict ${formatTime(new Date(data.syncStatus.lastConflictAt))}`)
              : null,
            data.syncStatus.lastConflictFingerprint
              ? h('div', { className: 'companion-home-item-time' }, `Conflict snapshot ${data.syncStatus.lastConflictFingerprint}`)
              : null,
            data.syncStatus.lastError
              ? h('div', { className: 'companion-home-item-time' }, `Sync status ${data.syncStatus.lastError}`)
              : null,
            data.syncJobs.length > 0
              ? h('div', { className: 'companion-home-brief-run-list' },
                ...data.syncJobs.map((job) => (
                  h('div', { className: 'companion-home-brief-run-card' },
                    h('div', { className: 'companion-home-brief-run-header' },
                      h('span', { className: 'companion-home-item-time' }, formatTime(new Date(job.createdAt))),
                      h('span', { className: 'companion-home-item-kind' }, `${humanizeToken(job.provider)} ${humanizeToken(job.operation)}`),
                    ),
                    h('div', { className: 'companion-home-brief-run-summary' }, job.message),
                    job.syncChannel
                      ? h('div', { className: 'companion-home-item-time' }, `Channel ${job.syncChannel}`)
                      : null,
                    job.fingerprint
                      ? h('div', { className: 'companion-home-item-time' }, `Local ${job.fingerprint}`)
                      : null,
                    job.remoteFingerprint
                      ? h('div', { className: 'companion-home-item-time' }, `Remote ${job.remoteFingerprint}`)
                      : null,
                  )
                )),
              )
              : null,
          ),
        ),
        h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title-row' },
              h('div', { className: 'companion-home-section-title' }, 'Notes'),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn',
                onClick: () => this.openNoteEditor(),
              }, this.noteEditorOpen && this.editingNoteId === null ? 'Close' : 'Add'),
            ),
            this.noteEditorOpen
              ? this.renderNoteEditor()
              : null,
            data.notes.length > 0
              ? h('div', { className: 'companion-home-note-list' },
              ...data.notes.slice(0, 6).map((note) => this.renderNote(note)),
            )
            : h('div', { className: 'companion-home-empty-copy' }, 'Capture persistent notes for this workspace here.'),
        ),
        h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title-row' },
              h('div', { className: 'companion-home-section-title' }, 'Threads'),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn',
                onClick: () => this.openThreadEditor(),
              }, this.threadEditorOpen && this.editingThreadId === null ? 'Close' : 'Add'),
            ),
            this.threadEditorOpen
              ? this.renderThreadEditor()
              : null,
            data.threads.length > 0
              ? h('div', { className: 'companion-home-note-list' },
              ...data.threads.slice(0, 6).map((thread) => this.renderThread(thread)),
            )
            : h('div', { className: 'companion-home-empty-copy' }, 'Create durable workspace threads from notes, ask runs, actions, or inbox items.'),
        ),
        h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title-row' },
              h('div', { className: 'companion-home-section-title' }, 'Actions'),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn',
                onClick: () => this.openActionEditor(),
              }, this.actionEditorOpen && this.editingActionId === null ? 'Close' : 'Add'),
            ),
            this.actionEditorOpen
              ? this.renderActionEditor()
              : null,
            data.actions.length > 0
              ? h('div', { className: 'companion-home-note-list' },
              ...data.actions.slice(0, 6).map((action) => this.renderAction(action)),
            )
            : h('div', { className: 'companion-home-empty-copy' }, 'Turn important items into durable follow-up actions here.'),
        ),
        h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title-row' },
              h('div', { className: 'companion-home-section-title' }, 'Automation'),
              h('button', {
                type: 'button',
                className: 'companion-home-action-btn',
                onClick: () => this.openAutomationEditor(),
              }, this.automationEditorOpen && this.editingAutomationRuleId === null ? 'Close' : 'Add'),
            ),
            this.automationEditorOpen
              ? this.renderAutomationEditor()
              : null,
            data.automationRules.length > 0
              ? h('div', { className: 'companion-home-note-list' },
              ...data.automationRules.slice(0, 6).map((rule) => this.renderAutomationRule(rule)),
            )
            : h('div', { className: 'companion-home-empty-copy' }, 'Create inbox or brief rules, then mute or snooze them when the workspace gets noisy.'),
        ),
        h('section', { className: 'companion-home-section' },
            h('div', { className: 'companion-home-section-title' }, 'Automation History'),
            data.automationHistory.length > 0
              ? h('div', { className: 'companion-home-note-list' },
              ...data.automationHistory.slice(0, 6).map((event) => this.renderAutomationHistoryEvent(event)),
            )
            : h('div', { className: 'companion-home-empty-copy' }, 'Rule fires will appear here after automation runs.'),
        ),
        h('section', { className: 'companion-home-section companion-home-inbox' },
          h('div', { className: 'companion-home-section-title' }, 'Priority Inbox'),
          visibleItems.length > 0
            ? h('div', { className: 'companion-home-item-list' },
              ...visibleItems.map((item) => renderCompanionInboxItemCard({
                item,
                compact: true,
                onSetItemState: this.options.onSetItemState,
                onToggleSnoozeItem: this.options.onToggleSnoozeItem,
                onToggleItemTag: this.options.onToggleItemTag,
                onSetItemFeedback: this.options.onSetItemFeedback,
                onCreateActionFromItem: this.options.onCreateActionFromItem,
                onCreateNoteFromItem: this.options.onCreateNoteFromItem,
                onCreateThreadFromItem: this.options.onCreateThreadFromItem,
              })),
            )
            : h('div', { className: 'companion-home-empty-copy' }, 'No companion items yet. Incoming news, markets, and predictions will collect here.'),
          h('div', { className: 'companion-home-footnote' },
            'Workspace, follow, inbox, note, and action state now persist locally on this device.',
          ),
        ),
      ),
    );
  }

  private renderStatCard(label: string, value: string): HTMLElement {
    return h('div', { className: 'companion-home-stat-card' },
      h('div', { className: 'companion-home-stat-value' }, value),
      h('div', { className: 'companion-home-stat-label' }, label),
    );
  }

  private renderFollowChip(follow: Follow): HTMLElement {
    return h('span', { className: 'companion-home-follow-chip removable' },
      h('span', {}, follow.label),
      follow.source === 'manual'
        ? h('button', {
          type: 'button',
          className: 'companion-home-chip-remove',
          onClick: () => this.options.onRemoveFollow(follow.id),
          title: 'Remove follow',
        }, '×')
        : null,
    );
  }

  private renderFollowComposer(): HTMLElement {
    return h('form', {
      className: 'companion-home-editor-card',
      onSubmit: (event: Event) => {
        event.preventDefault();
        this.handleAddFollow();
      },
    },
    h('input', {
      className: 'companion-home-input',
      value: this.followLabelDraft,
      placeholder: 'Label',
      onInput: (event: Event) => {
        this.followLabelDraft = (event.target as HTMLInputElement).value;
      },
    }),
    h('input', {
      className: 'companion-home-input',
      value: this.followQueryDraft,
      placeholder: 'Query or ticker',
      onInput: (event: Event) => {
        this.followQueryDraft = (event.target as HTMLInputElement).value;
      },
    }),
    h('div', { className: 'companion-home-inline-actions' },
      h('button', { type: 'submit', className: 'companion-home-action-btn' }, 'Save Follow'),
      h('button', {
        type: 'button',
        className: 'companion-home-action-btn subtle',
        onClick: () => this.closeFollowComposer(),
      }, 'Cancel'),
    ));
  }

  private renderAskComposer(): HTMLElement {
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
      h('button', { type: 'submit', className: 'companion-home-action-btn' }, 'Ask'),
    ));
  }

  private renderWorkspaceEditor(workspace: Workspace): HTMLElement {
    return h('form', {
      className: 'companion-home-editor-card',
      onSubmit: (event: Event) => {
        event.preventDefault();
        this.handleSaveWorkspace(workspace.id);
      },
    },
    h('input', {
      className: 'companion-home-input',
      value: this.workspaceNameDraft,
      placeholder: 'Workspace name',
      onInput: (event: Event) => {
        this.workspaceNameDraft = (event.target as HTMLInputElement).value;
      },
    }),
    h('textarea', {
      className: 'companion-home-textarea',
      placeholder: 'Workspace description',
      onInput: (event: Event) => {
        this.workspaceDescriptionDraft = (event.target as HTMLTextAreaElement).value;
      },
    }, this.workspaceDescriptionDraft),
    h('div', { className: 'companion-home-inline-actions' },
      h('button', { type: 'submit', className: 'companion-home-action-btn' }, 'Save Workspace'),
      workspace.legacyBacked
        ? null
        : h('button', {
          type: 'button',
          className: 'companion-home-action-btn subtle',
          onClick: () => this.options.onDeleteWorkspace(workspace.id),
        }, 'Delete Workspace'),
      h('button', {
        type: 'button',
        className: 'companion-home-action-btn subtle',
        onClick: () => this.closeWorkspaceEditor(),
      }, 'Cancel'),
    ));
  }

  private renderNote(note: MemoryNote): HTMLElement {
    const activeWorkspace = this.options.getData().activeWorkspace;
    const followLabelById = new Map((activeWorkspace?.follows ?? []).map((follow) => [follow.id, follow.label]));
    return h('article', { className: 'companion-home-note-item' },
      h('div', { className: 'companion-home-note-header' },
        h('div', { className: 'companion-home-note-title' }, note.title),
        h('div', { className: 'companion-home-inline-actions' },
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.options.onCreateThreadFromNote(note.id),
          }, 'Thread'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.openNoteEditor(note),
          }, 'Edit'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.options.onDeleteNote(note.id),
          }, 'Delete'),
        ),
      ),
      h('div', { className: 'companion-home-note-body' }, note.body),
      note.linkedFollowIds.length > 0
        ? h('div', { className: 'companion-item-tags' },
          ...note.linkedFollowIds.map((followId) => (
            h('span', { className: 'companion-item-tag active' }, followLabelById.get(followId) ?? 'Linked follow')
          )),
        )
        : null,
      note.linkedItemIds.length > 0
        ? h('div', { className: 'companion-home-item-time' }, `Linked to ${note.linkedItemIds.length} inbox item${note.linkedItemIds.length === 1 ? '' : 's'}`)
        : null,
      h('div', { className: 'companion-home-item-time' }, formatTime(new Date(note.updatedAt))),
    );
  }

  private renderAskRun(run: AskRun): HTMLElement {
    const data = this.options.getData();
    const itemById = new Map(data.inboxItems.map((item) => [item.id, item.title]));
    const briefById = new Map(data.briefs.flatMap((brief) => brief.recentRuns.map((recent) => [recent.id, brief.title] as const)));
    const noteById = new Map(data.notes.map((note) => [note.id, note.title]));
    const followById = new Map((data.activeWorkspace?.follows ?? []).map((follow) => [follow.id, follow.label]));
    return h('article', { className: 'companion-home-note-item' },
      h('div', { className: 'companion-home-note-header' },
        h('div', { className: 'companion-home-note-title' },
          h('span', { className: 'companion-home-item-kind' }, humanizeToken(run.intent)),
          ' ',
          run.question,
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
      h('div', { className: 'companion-home-note-body' }, run.answer),
      (run.citedItemIds.length > 0 || run.citedBriefRunIds.length > 0 || run.citedNoteIds.length > 0 || run.citedThreadIds.length > 0)
        ? h('div', { className: 'companion-item-tags' },
          ...run.citedItemIds.slice(0, 3).map((id) => (
            h('span', { className: 'companion-item-tag active' }, itemById.get(id) ?? 'Signal')
          )),
          ...run.citedBriefRunIds.slice(0, 2).map((id) => (
            h('span', { className: 'companion-item-tag active' }, briefById.get(id) ?? 'Brief')
          )),
          ...run.citedNoteIds.slice(0, 2).map((id) => (
            h('span', { className: 'companion-item-tag active' }, noteById.get(id) ?? 'Note')
          )),
          ...run.citedFollowIds.slice(0, 2).map((id) => (
            h('span', { className: 'companion-item-tag active' }, followById.get(id) ?? 'Follow')
          )),
          ...run.citedThreadIds.slice(0, 2).map((id) => (
            h('span', { className: 'companion-item-tag active' }, data.threads.find((thread) => thread.id === id)?.title ?? 'Thread')
          )),
        )
        : null,
      h('div', { className: 'companion-home-item-time' }, formatTime(new Date(run.updatedAt))),
    );
  }

  private renderNoteEditor(): HTMLElement {
    const isEditing = this.editingNoteId !== null;
    const activeWorkspace = this.options.getData().activeWorkspace;
    return h('form', {
      className: 'companion-home-editor-card',
      onSubmit: (event: Event) => {
        event.preventDefault();
        this.handleSaveNote();
      },
    },
    h('input', {
      className: 'companion-home-input',
      value: this.noteTitleDraft,
      placeholder: 'Note title',
      onInput: (event: Event) => {
        this.noteTitleDraft = (event.target as HTMLInputElement).value;
      },
    }),
    h('textarea', {
      className: 'companion-home-textarea',
      placeholder: 'Write a durable workspace note',
      onInput: (event: Event) => {
        this.noteBodyDraft = (event.target as HTMLTextAreaElement).value;
      },
    }, this.noteBodyDraft),
    activeWorkspace && activeWorkspace.follows.length > 0
      ? h('div', { className: 'companion-item-tags' },
        ...activeWorkspace.follows.slice(0, 10).map((follow) => (
          h('button', {
            type: 'button',
            className: `companion-item-tag${this.noteLinkedFollowIdsDraft.includes(follow.id) ? ' active' : ''}`,
            onClick: () => {
              this.toggleNoteFollow(follow.id);
            },
          }, follow.label)
        )),
      )
      : null,
    h('div', { className: 'companion-home-inline-actions' },
      h('button', { type: 'submit', className: 'companion-home-action-btn' }, isEditing ? 'Update Note' : 'Save Note'),
      h('button', {
        type: 'button',
        className: 'companion-home-action-btn subtle',
        onClick: () => this.closeNoteEditor(),
      }, 'Cancel'),
    ));
  }

  private renderThread(thread: Thread): HTMLElement {
    const links = [
      thread.linkedItemIds.length > 0 ? `${thread.linkedItemIds.length} item${thread.linkedItemIds.length === 1 ? '' : 's'}` : null,
      thread.linkedNoteIds.length > 0 ? `${thread.linkedNoteIds.length} note${thread.linkedNoteIds.length === 1 ? '' : 's'}` : null,
      thread.linkedActionIds.length > 0 ? `${thread.linkedActionIds.length} action${thread.linkedActionIds.length === 1 ? '' : 's'}` : null,
      thread.linkedBriefRunIds.length > 0 ? `${thread.linkedBriefRunIds.length} brief${thread.linkedBriefRunIds.length === 1 ? '' : 's'}` : null,
      thread.linkedAskRunIds.length > 0 ? `${thread.linkedAskRunIds.length} ask run${thread.linkedAskRunIds.length === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · ');
    return h('article', { className: 'companion-home-note-item' },
      h('div', { className: 'companion-home-note-header' },
        h('div', { className: 'companion-home-note-title' }, thread.title),
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
      h('div', { className: 'companion-home-note-body' }, thread.summary),
      links
        ? h('div', { className: 'companion-home-item-time' }, links)
        : null,
      h('div', { className: 'companion-home-item-time' }, formatTime(new Date(thread.updatedAt))),
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

  private renderAction(action: ActionItem): HTMLElement {
    return h('article', { className: 'companion-home-note-item' },
      h('div', { className: 'companion-home-note-header' },
        h('div', { className: 'companion-home-note-title' }, action.title),
        h('div', { className: 'companion-home-inline-actions' },
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.options.onCreateThreadFromAction(action.id),
          }, 'Thread'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.openActionEditor(action),
          }, 'Edit'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn',
            onClick: () => this.options.onToggleAction(action.id, action.status === 'done' ? 'open' : 'done'),
          }, action.status === 'done' ? 'Reopen' : 'Done'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.options.onDeleteAction(action.id),
          }, 'Delete'),
        ),
      ),
      h('div', { className: 'companion-home-note-body' }, action.relatedItemIds.length > 0 ? 'Linked to saved signal context.' : 'Standalone action item.'),
      action.dueAt
        ? h('div', { className: 'companion-home-item-time' }, `Reminder ${formatTime(new Date(action.dueAt))}`)
        : null,
      h('div', { className: 'companion-home-item-time' }, formatTime(new Date(action.updatedAt))),
    );
  }

  private renderActionEditor(): HTMLElement {
    const isEditing = this.editingActionId !== null;
    return h('form', {
      className: 'companion-home-editor-card',
      onSubmit: (event: Event) => {
        event.preventDefault();
        this.handleSaveAction();
      },
    },
    h('input', {
      className: 'companion-home-input',
      value: this.actionTitleDraft,
      placeholder: 'Action title',
      onInput: (event: Event) => {
        this.actionTitleDraft = (event.target as HTMLInputElement).value;
      },
    }),
    h('select', {
      className: 'companion-home-input',
      value: this.actionDuePreset,
      onInput: (event: Event) => {
        this.actionDuePreset = (event.target as HTMLSelectElement).value;
      },
    },
    h('option', { value: 'none' }, 'No reminder'),
    h('option', { value: 'today' }, 'Later today'),
    h('option', { value: 'tomorrow' }, 'Tomorrow'),
    h('option', { value: 'next_week' }, 'Next week'),
    ),
    h('div', { className: 'companion-home-inline-actions' },
      h('button', { type: 'submit', className: 'companion-home-action-btn' }, isEditing ? 'Update Action' : 'Save Action'),
      h('button', {
        type: 'button',
        className: 'companion-home-action-btn subtle',
        onClick: () => this.closeActionEditor(),
      }, 'Cancel'),
    ));
  }

  private renderAutomationRule(rule: AutomationRule): HTMLElement {
    const muted = typeof rule.mutedUntil === 'number' && rule.mutedUntil > Date.now();
    return h('article', { className: 'companion-home-note-item' },
      h('div', { className: 'companion-home-note-header' },
        h('div', { className: 'companion-home-note-title' }, rule.name),
        h('div', { className: 'companion-home-inline-actions' },
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.openAutomationEditor(rule),
          }, 'Edit'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn',
            onClick: () => this.options.onToggleAutomationRule(rule.id, !rule.enabled),
          }, rule.enabled ? 'Disable' : 'Enable'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => muted
              ? this.options.onResumeAutomationRule(rule.id)
              : this.options.onSnoozeAutomationRule(rule.id),
          }, muted ? 'Resume' : 'Snooze'),
          h('button', {
            type: 'button',
            className: 'companion-home-action-btn subtle',
            onClick: () => this.options.onDeleteAutomationRule(rule.id),
          }, 'Delete'),
        ),
      ),
      h('div', { className: 'companion-home-note-body' },
        `${humanizeToken(rule.trigger)} via ${humanizeToken(rule.action)} at score ${rule.minimumScore}+`,
      ),
      muted
        ? h('div', { className: 'companion-home-item-time' }, `Muted until ${formatTime(new Date(rule.mutedUntil ?? Date.now()))}`)
        : null,
      h('div', { className: 'companion-home-item-time' }, rule.enabled ? 'Automation active' : 'Automation paused'),
    );
  }

  private renderAutomationHistoryEvent(event: AutomationEvent): HTMLElement {
    return h('article', { className: 'companion-home-note-item' },
      h('div', { className: 'companion-home-note-header' },
        h('div', { className: 'companion-home-note-title' }, event.title),
        h('span', { className: 'companion-home-item-kind' }, humanizeToken(event.trigger)),
      ),
      h('div', { className: 'companion-home-note-body' }, event.subtitle),
      h('div', { className: 'companion-home-item-time' }, `${humanizeToken(event.action)} • ${formatTime(new Date(event.createdAt))}`),
    );
  }

  private renderAutomationEditor(): HTMLElement {
    const isEditing = this.editingAutomationRuleId !== null;
    return h('form', {
      className: 'companion-home-editor-card',
      onSubmit: (event: Event) => {
        event.preventDefault();
        this.handleSaveAutomationRule();
      },
    },
    h('input', {
      className: 'companion-home-input',
      value: this.automationNameDraft,
      placeholder: 'Rule name',
      onInput: (event: Event) => {
        this.automationNameDraft = (event.target as HTMLInputElement).value;
      },
    }),
    h('select', {
      className: 'companion-home-input',
      value: this.automationTriggerDraft,
      onInput: (event: Event) => {
        this.automationTriggerDraft = (event.target as HTMLSelectElement).value as AutomationRule['trigger'];
      },
    },
    h('option', { value: 'high_priority_item' }, 'High priority item'),
    h('option', { value: 'saved_item' }, 'Saved item'),
    h('option', { value: 'follow_hit' }, 'Follow hit'),
    h('option', { value: 'brief_ready' }, 'Brief ready'),
    h('option', { value: 'stale_workspace' }, 'Stale workspace'),
    ),
    h('select', {
      className: 'companion-home-input',
      value: this.automationActionDraft,
      onInput: (event: Event) => {
        this.automationActionDraft = (event.target as HTMLSelectElement).value as AutomationRule['action'];
      },
    },
    h('option', { value: 'in_app' }, 'In-app inbox'),
    h('option', { value: 'desktop' }, 'Desktop notification'),
    h('option', { value: 'create_action' }, 'Auto-create action'),
    h('option', { value: 'queue_brief' }, 'Queue morning brief'),
    ),
    h('input', {
      className: 'companion-home-input',
      type: 'number',
      min: '0',
      max: '100',
      step: '5',
      value: this.automationMinimumScoreDraft,
      placeholder: 'Minimum score',
      onInput: (event: Event) => {
        this.automationMinimumScoreDraft = (event.target as HTMLInputElement).value;
      },
    }),
    h('div', { className: 'companion-home-inline-actions' },
      h('button', { type: 'submit', className: 'companion-home-action-btn' }, isEditing ? 'Update Rule' : 'Save Rule'),
      h('button', {
        type: 'button',
        className: 'companion-home-action-btn subtle',
        onClick: () => this.closeAutomationEditor(),
      }, 'Cancel'),
    ));
  }

  private handleCreateWorkspace(): void {
    const name = window.prompt('Name the new workspace');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    this.options.onCreateWorkspace(trimmed);
  }

  private handleAddFollow(): void {
    const label = this.followLabelDraft.trim();
    const query = this.followQueryDraft.trim();
    if (!label || !query) return;
    this.options.onAddFollow(label, query);
    this.closeFollowComposer();
  }

  private handleAskWorkspace(): void {
    const question = this.askDraft.trim();
    if (!question) return;
    this.options.onAskWorkspace(question);
    this.askDraft = '';
    this.render();
  }

  private handleSaveNote(): void {
    const title = this.noteTitleDraft.trim();
    const body = this.noteBodyDraft.trim();
    if (!title || !body) return;
    this.options.onSaveNote({
      id: this.editingNoteId ?? undefined,
      title,
      body,
      linkedFollowIds: this.noteLinkedFollowIdsDraft,
    });
    this.closeNoteEditor();
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

  private handleRenameProfile(): void {
    const next = this.profileDraft.trim();
    if (!next) return;
    this.options.onRenameProfile(next);
    this.closeProfileEditor();
  }

  private handleSaveAction(): void {
    const title = this.actionTitleDraft.trim();
    if (!title) return;
    this.options.onSaveAction({
      id: this.editingActionId ?? undefined,
      title,
      dueAt: toDueAt(this.actionDuePreset),
    });
    this.closeActionEditor();
  }

  private handleSaveAutomationRule(): void {
    const name = this.automationNameDraft.trim();
    const minimumScore = Number(this.automationMinimumScoreDraft);
    if (!name || !Number.isFinite(minimumScore)) return;
    this.options.onSaveAutomationRule({
      id: this.editingAutomationRuleId ?? undefined,
      name,
      trigger: this.automationTriggerDraft,
      action: this.automationActionDraft,
      minimumScore: Math.max(0, Math.min(100, Math.round(minimumScore))),
    });
    this.closeAutomationEditor();
  }

  private handleSaveWorkspace(workspaceId: string): void {
    const name = this.workspaceNameDraft.trim();
    if (!name) return;
    this.options.onUpdateWorkspace({
      id: workspaceId,
      name,
      description: this.workspaceDescriptionDraft.trim(),
    });
    this.closeWorkspaceEditor();
  }

  private openProfileEditor(currentName: string): void {
    this.profileEditorOpen = true;
    this.profileDraft = currentName;
    this.render();
  }

  private closeProfileEditor(): void {
    this.profileEditorOpen = false;
    this.profileDraft = '';
    this.render();
  }

  private openFollowComposer(): void {
    this.followComposerOpen = !this.followComposerOpen;
    if (!this.followComposerOpen) {
      this.closeFollowComposer();
      return;
    }
    this.followLabelDraft = '';
    this.followQueryDraft = '';
    this.render();
  }

  private closeFollowComposer(): void {
    this.followComposerOpen = false;
    this.followLabelDraft = '';
    this.followQueryDraft = '';
    this.render();
  }

  private openWorkspaceEditor(workspace: Workspace): void {
    if (this.workspaceEditorOpen) {
      this.closeWorkspaceEditor();
      return;
    }
    this.workspaceEditorOpen = true;
    this.workspaceNameDraft = workspace.name;
    this.workspaceDescriptionDraft = workspace.description || '';
    this.render();
  }

  private closeWorkspaceEditor(): void {
    this.workspaceEditorOpen = false;
    this.workspaceNameDraft = '';
    this.workspaceDescriptionDraft = '';
    this.render();
  }

  private openNoteEditor(note?: MemoryNote): void {
    this.noteEditorOpen = true;
    this.editingNoteId = note?.id ?? null;
    this.noteTitleDraft = note?.title ?? '';
    this.noteBodyDraft = note?.body ?? '';
    this.noteLinkedFollowIdsDraft = [...(note?.linkedFollowIds ?? [])];
    this.render();
  }

  private closeNoteEditor(): void {
    this.noteEditorOpen = false;
    this.editingNoteId = null;
    this.noteTitleDraft = '';
    this.noteBodyDraft = '';
    this.noteLinkedFollowIdsDraft = [];
    this.render();
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

  private openActionEditor(action?: ActionItem): void {
    this.actionEditorOpen = true;
    this.editingActionId = action?.id ?? null;
    this.actionTitleDraft = action?.title ?? '';
    this.actionDuePreset = toDuePreset(action?.dueAt);
    this.render();
  }

  private closeActionEditor(): void {
    this.actionEditorOpen = false;
    this.editingActionId = null;
    this.actionTitleDraft = '';
    this.actionDuePreset = 'none';
    this.render();
  }

  private toggleNoteFollow(followId: string): void {
    this.noteLinkedFollowIdsDraft = this.noteLinkedFollowIdsDraft.includes(followId)
      ? this.noteLinkedFollowIdsDraft.filter((entry) => entry !== followId)
      : [...this.noteLinkedFollowIdsDraft, followId];
    this.render();
  }

  private openAutomationEditor(rule?: AutomationRule): void {
    this.automationEditorOpen = true;
    this.editingAutomationRuleId = rule?.id ?? null;
    this.automationNameDraft = rule?.name ?? '';
    this.automationTriggerDraft = rule?.trigger ?? 'high_priority_item';
    this.automationActionDraft = rule?.action ?? 'in_app';
    this.automationMinimumScoreDraft = String(rule?.minimumScore ?? 70);
    this.render();
  }

  private closeAutomationEditor(): void {
    this.automationEditorOpen = false;
    this.editingAutomationRuleId = null;
    this.automationNameDraft = '';
    this.automationTriggerDraft = 'high_priority_item';
    this.automationActionDraft = 'in_app';
    this.automationMinimumScoreDraft = '70';
    this.render();
  }
}
