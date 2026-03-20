import type { Profile } from '@/types';
import type { SessionSnapshot } from '@/app/session-store';
import type { WorkspaceStore } from '@/app/workspace-store';
import type { InboxStore } from '@/app/inbox-store';
import type { BriefingStore } from '@/app/briefing-store';
import {
  loadProfile,
  saveProfile,
} from './profile-store';
import {
  loadWorkspaceStoreSnapshot,
} from './workspace-store';
import {
  loadInboxStoreSnapshot,
} from './inbox-store';
import {
  loadNoteStoreSnapshot,
  saveNoteStoreSnapshot,
} from './note-store';
import {
  loadActionStoreSnapshot,
  saveActionStoreSnapshot,
} from './action-store';
import {
  loadAutomationStoreSnapshot,
  saveAutomationStoreSnapshot,
} from './automation-store';
import {
  loadAutomationHistorySnapshot,
  saveAutomationHistorySnapshot,
} from './automation-history-store';
import {
  loadAskStoreSnapshot,
  saveAskStoreSnapshot,
} from './ask-store';
import {
  loadCompanionSyncSnapshot,
  saveCompanionSyncSnapshot,
} from './companion-sync';
import {
  loadThreadStoreSnapshot,
  saveThreadStoreSnapshot,
} from './thread-store';
import {
  loadSyncJobSnapshot,
  saveSyncJobSnapshot,
} from './sync-job-store';

export interface CompanionBackupDocument {
  version: 1;
  exportedAt: number;
  profile: Profile;
  session: Pick<SessionSnapshot, 'activeWorkspaceId' | 'previousVisitedAt' | 'lastVisitedAt' | 'currentVariant'>;
  workspaces: ReturnType<typeof loadWorkspaceStoreSnapshot>;
  inbox: ReturnType<typeof loadInboxStoreSnapshot>;
  briefing: ReturnType<BriefingStore['exportSnapshot']>;
  notes: ReturnType<typeof loadNoteStoreSnapshot>;
  actions: ReturnType<typeof loadActionStoreSnapshot>;
  automation: ReturnType<typeof loadAutomationStoreSnapshot>;
  automationHistory: ReturnType<typeof loadAutomationHistorySnapshot>;
  askRuns: ReturnType<typeof loadAskStoreSnapshot>;
  threads: ReturnType<typeof loadThreadStoreSnapshot>;
  sync: Pick<
    ReturnType<typeof loadCompanionSyncSnapshot>,
    | 'provider'
    | 'syncChannel'
    | 'lastProbedAt'
    | 'lastExportedAt'
    | 'lastImportedAt'
    | 'lastPushedAt'
    | 'lastPulledAt'
    | 'lastFingerprint'
    | 'remoteExportedAt'
    | 'remoteUpdatedAt'
    | 'remoteFingerprint'
    | 'remoteInstallationId'
    | 'lastConflictAt'
    | 'lastConflictFingerprint'
    | 'lastError'
  >;
  syncJobs: ReturnType<typeof loadSyncJobSnapshot>;
}

export function buildCompanionBackupDocument(
  session: SessionSnapshot,
  briefingStore: BriefingStore,
): CompanionBackupDocument {
  return {
    version: 1,
    exportedAt: Date.now(),
    profile: loadProfile(),
    session: {
      activeWorkspaceId: session.activeWorkspaceId,
      previousVisitedAt: session.previousVisitedAt,
      lastVisitedAt: session.lastVisitedAt,
      currentVariant: session.currentVariant,
    },
    workspaces: loadWorkspaceStoreSnapshot(),
    inbox: loadInboxStoreSnapshot(),
    briefing: briefingStore.exportSnapshot(),
    notes: loadNoteStoreSnapshot(),
    actions: loadActionStoreSnapshot(),
    automation: loadAutomationStoreSnapshot(),
    automationHistory: loadAutomationHistorySnapshot(),
    askRuns: loadAskStoreSnapshot(),
    threads: loadThreadStoreSnapshot(),
    sync: (() => {
      const snapshot = loadCompanionSyncSnapshot();
      return {
        provider: snapshot.provider,
        syncChannel: snapshot.syncChannel,
        lastProbedAt: snapshot.lastProbedAt,
        lastExportedAt: snapshot.lastExportedAt,
        lastImportedAt: snapshot.lastImportedAt,
        lastPushedAt: snapshot.lastPushedAt,
        lastPulledAt: snapshot.lastPulledAt,
        lastFingerprint: snapshot.lastFingerprint,
        remoteExportedAt: snapshot.remoteExportedAt,
        remoteUpdatedAt: snapshot.remoteUpdatedAt,
        remoteFingerprint: snapshot.remoteFingerprint,
        remoteInstallationId: snapshot.remoteInstallationId,
        lastConflictAt: snapshot.lastConflictAt,
        lastConflictFingerprint: snapshot.lastConflictFingerprint,
        lastError: snapshot.lastError,
      };
    })(),
    syncJobs: loadSyncJobSnapshot(),
  };
}

export function parseCompanionBackupDocument(raw: string): CompanionBackupDocument | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CompanionBackupDocument>;
    if (parsed.version !== 1) return null;
    if (!parsed.workspaces || !parsed.inbox || !parsed.briefing) return null;
    if (!parsed.profile || !parsed.session) return null;
    return parsed as CompanionBackupDocument;
  } catch {
    return null;
  }
}

export function restoreCompanionBackupDocument(
  document: CompanionBackupDocument,
  deps: {
    sessionStore: { replaceSnapshot: (snapshot: Partial<SessionSnapshot>) => void };
    workspaceStore: WorkspaceStore & { replaceSnapshot: (snapshot: { workspaces: typeof document.workspaces.workspaces; updatedAt?: number }) => void };
    inboxStore: InboxStore & { replaceSnapshot: (snapshot: typeof document.inbox) => void };
    briefingStore: BriefingStore;
  },
): void {
  saveProfile({
    displayName: document.profile.displayName,
    preferredLanguage: document.profile.preferredLanguage,
    preferredBriefTone: document.profile.preferredBriefTone,
    syncMode: document.profile.syncMode,
  });
  deps.workspaceStore.replaceSnapshot(document.workspaces);
  deps.inboxStore.replaceSnapshot(document.inbox);
  deps.briefingStore.replaceSnapshot(document.briefing);
  saveNoteStoreSnapshot(document.notes);
  saveActionStoreSnapshot(document.actions);
  saveAutomationStoreSnapshot(document.automation);
  saveAutomationHistorySnapshot(document.automationHistory ?? { events: [], updatedAt: Date.now() });
  saveAskStoreSnapshot(document.askRuns ?? { runs: [], updatedAt: Date.now() });
  saveThreadStoreSnapshot(document.threads ?? { threads: [], updatedAt: Date.now() });
  saveCompanionSyncSnapshot({
    provider: document.sync?.provider ?? (document.profile.syncMode === 'sync' ? 'manual' : 'none'),
    syncChannel: document.sync?.syncChannel ?? '',
    lastProbedAt: document.sync?.lastProbedAt ?? null,
    lastExportedAt: document.sync?.lastExportedAt ?? null,
    lastImportedAt: document.sync?.lastImportedAt ?? null,
    lastPushedAt: document.sync?.lastPushedAt ?? null,
    lastPulledAt: document.sync?.lastPulledAt ?? null,
    lastFingerprint: document.sync?.lastFingerprint ?? null,
    remoteExportedAt: document.sync?.remoteExportedAt ?? null,
    remoteUpdatedAt: document.sync?.remoteUpdatedAt ?? null,
    remoteFingerprint: document.sync?.remoteFingerprint ?? null,
    remoteInstallationId: document.sync?.remoteInstallationId ?? null,
    lastConflictAt: document.sync?.lastConflictAt ?? null,
    lastConflictFingerprint: document.sync?.lastConflictFingerprint ?? null,
    lastError: document.sync?.lastError ?? null,
  });
  saveSyncJobSnapshot(document.syncJobs ?? { jobs: [], updatedAt: Date.now() });
  deps.sessionStore.replaceSnapshot(document.session);
}
