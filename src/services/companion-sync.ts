import { generateId, loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-sync-v1';
const MANUAL_SYNC_PAYLOAD_KEY = 'wm-companion-sync-manual-payload-v1';

export interface CompanionSyncSnapshot {
  mode: 'local' | 'sync';
  provider: 'none' | 'manual' | 'convex';
  installationId: string;
  syncChannel: string;
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
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: CompanionSyncSnapshot = {
  mode: 'local',
  provider: 'none',
  installationId: generateId(),
  syncChannel: '',
  lastProbedAt: null,
  lastExportedAt: null,
  lastImportedAt: null,
  lastPushedAt: null,
  lastPulledAt: null,
  lastFingerprint: null,
  remoteExportedAt: null,
  remoteUpdatedAt: null,
  remoteFingerprint: null,
  remoteInstallationId: null,
  lastConflictAt: null,
  lastConflictFingerprint: null,
  lastError: null,
  updatedAt: 0,
};

const listeners = new Set<() => void>();

export function loadCompanionSyncSnapshot(): CompanionSyncSnapshot {
  const snapshot = loadFromStorage<CompanionSyncSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  return {
    ...DEFAULT_SNAPSHOT,
    ...snapshot,
    installationId: typeof snapshot.installationId === 'string' && snapshot.installationId.trim()
      ? snapshot.installationId
      : DEFAULT_SNAPSHOT.installationId,
    syncChannel: normalizeCompanionSyncChannel(snapshot.syncChannel ?? ''),
  };
}

export function saveCompanionSyncSnapshot(partial: Partial<CompanionSyncSnapshot>): CompanionSyncSnapshot {
  const current = loadCompanionSyncSnapshot();
  const next = {
    ...current,
    ...partial,
    updatedAt: Date.now(),
  };
  saveToStorage(STORAGE_KEY, next);
  for (const listener of listeners) listener();
  return next;
}

export function subscribeCompanionSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function normalizeCompanionSyncChannel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, '-').slice(0, 64);
}

export function buildSuggestedCompanionSyncChannel(profileName: string, installationId: string): string {
  const suffix = installationId.replace(/^id-/, '').slice(0, 8);
  const base = normalizeCompanionSyncChannel(profileName || 'local-user');
  return normalizeCompanionSyncChannel(`${base || 'local-user'}-${suffix}`);
}

export function getCompanionSyncConvexUrl(): string {
  return import.meta.env.VITE_CONVEX_URL?.trim() ?? '';
}

export function isCompanionSyncConvexAvailable(): boolean {
  return getCompanionSyncConvexUrl().length > 0;
}

export function buildCompanionFingerprint(raw: string): string {
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface CompanionSyncProviderDescriptor {
  id: CompanionSyncSnapshot['provider'];
  label: string;
  available: boolean;
  supportsPush: boolean;
  supportsPull: boolean;
}

export interface CompanionSyncReadinessCheck {
  id: 'mode' | 'provider' | 'provider_env' | 'channel';
  label: string;
  ok: boolean;
  detail: string;
}

export interface CompanionSyncComparison {
  state: 'unknown' | 'local_only' | 'remote_only' | 'in_sync' | 'local_ahead' | 'remote_ahead' | 'conflict';
  summary: string;
}

export interface CompanionSyncRecommendation {
  label: string;
  detail: string;
}

export function listCompanionSyncProviders(): CompanionSyncProviderDescriptor[] {
  return [
    {
      id: 'none',
      label: 'Local only',
      available: true,
      supportsPush: false,
      supportsPull: false,
    },
    {
      id: 'manual',
      label: 'Manual sync',
      available: true,
      supportsPush: true,
      supportsPull: true,
    },
    {
      id: 'convex',
      label: 'Convex',
      available: isCompanionSyncConvexAvailable(),
      supportsPush: isCompanionSyncConvexAvailable(),
      supportsPull: isCompanionSyncConvexAvailable(),
    },
  ];
}

export function buildCompanionSyncReadiness(
  syncMode: 'local' | 'sync',
  snapshot: CompanionSyncSnapshot,
): CompanionSyncReadinessCheck[] {
  const provider = snapshot.provider;
  return [
    {
      id: 'mode',
      label: 'Sync mode',
      ok: syncMode === 'sync',
      detail: syncMode === 'sync'
        ? 'Profile sync mode is enabled.'
        : 'Profile is still in local-only mode.',
    },
    {
      id: 'provider',
      label: 'Provider',
      ok: provider !== 'none',
      detail: provider === 'none'
        ? 'No sync provider selected yet.'
        : `Provider ${provider} is selected.`,
    },
    {
      id: 'provider_env',
      label: 'Provider availability',
      ok: provider !== 'convex' || isCompanionSyncConvexAvailable(),
      detail: provider !== 'convex'
        ? 'No remote provider env required.'
        : isCompanionSyncConvexAvailable()
          ? 'VITE_CONVEX_URL is configured.'
          : 'VITE_CONVEX_URL is missing.',
    },
    {
      id: 'channel',
      label: 'Shared channel',
      ok: provider !== 'convex' || snapshot.syncChannel.length > 0,
      detail: provider !== 'convex'
        ? 'Manual/local providers do not require a shared channel.'
        : snapshot.syncChannel.length > 0
          ? `Using shared channel ${snapshot.syncChannel}.`
          : 'Choose a shared sync channel before pushing or pulling.',
    },
  ];
}

export function buildCompanionSyncComparison(snapshot: CompanionSyncSnapshot): CompanionSyncComparison {
  if (snapshot.lastConflictAt) {
    return {
      state: 'conflict',
      summary: 'Remote conflict detected. Pull first or use force push if this install should win.',
    };
  }
  if (!snapshot.lastFingerprint && !snapshot.remoteFingerprint) {
    return {
      state: 'unknown',
      summary: 'No local or remote snapshot has been observed yet.',
    };
  }
  if (snapshot.lastFingerprint && !snapshot.remoteFingerprint) {
    return {
      state: 'local_only',
      summary: 'This install has a local snapshot, but no remote snapshot is known yet.',
    };
  }
  if (!snapshot.lastFingerprint && snapshot.remoteFingerprint) {
    return {
      state: 'remote_only',
      summary: 'A remote snapshot exists, but this install has not exported or imported one yet.',
    };
  }
  if (snapshot.lastFingerprint && snapshot.remoteFingerprint && snapshot.lastFingerprint === snapshot.remoteFingerprint) {
    return {
      state: 'in_sync',
      summary: snapshot.remoteInstallationId === snapshot.installationId
        ? 'Local and remote snapshots match, and the remote copy was last written by this install.'
        : 'Local and remote snapshots match.',
    };
  }
  if (
    typeof snapshot.lastExportedAt === 'number'
    && typeof snapshot.remoteExportedAt === 'number'
    && snapshot.lastExportedAt > snapshot.remoteExportedAt
  ) {
    return {
      state: 'local_ahead',
      summary: 'Local companion state is newer than the last known remote snapshot.',
    };
  }
  if (
    typeof snapshot.lastExportedAt === 'number'
    && typeof snapshot.remoteExportedAt === 'number'
    && snapshot.remoteExportedAt > snapshot.lastExportedAt
  ) {
    return {
      state: 'remote_ahead',
      summary: 'Remote companion state is newer than the last known local export.',
    };
  }
  return {
    state: 'unknown',
    summary: 'Local and remote snapshots differ, but freshness is not yet conclusive.',
  };
}

export function buildCompanionSyncRecommendation(
  syncMode: 'local' | 'sync',
  snapshot: CompanionSyncSnapshot,
  comparison: CompanionSyncComparison,
): CompanionSyncRecommendation {
  if (syncMode !== 'sync') {
    return {
      label: 'Enable Sync Mode',
      detail: 'Switch the profile to sync mode before using any provider operations.',
    };
  }
  if (snapshot.provider === 'none') {
    return {
      label: 'Choose A Provider',
      detail: 'Select Manual or Convex before pushing or pulling companion state.',
    };
  }
  if (snapshot.provider === 'convex' && !isCompanionSyncConvexAvailable()) {
    return {
      label: 'Configure Convex URL',
      detail: 'Set VITE_CONVEX_URL, reload the app, and then retry the Convex provider.',
    };
  }
  if (snapshot.provider === 'convex' && !snapshot.syncChannel) {
    return {
      label: 'Save Shared Channel',
      detail: 'Choose one shared sync channel on every install before probing, pushing, or pulling.',
    };
  }
  switch (comparison.state) {
    case 'local_only':
      return {
        label: 'Push First Snapshot',
        detail: 'This install has local state only. Push it if this device should seed the remote copy.',
      };
    case 'remote_only':
      return {
        label: 'Pull Remote Snapshot',
        detail: 'A remote snapshot exists. Pull it here before making local edits on this install.',
      };
    case 'local_ahead':
      return {
        label: 'Push Newer Local State',
        detail: 'This install appears newer than remote. Push to update the shared snapshot.',
      };
    case 'remote_ahead':
      return {
        label: 'Pull Newer Remote State',
        detail: 'Remote appears newer than this install. Pull it unless you intentionally want to overwrite it.',
      };
    case 'conflict':
      return {
        label: 'Resolve Conflict',
        detail: 'Pull first to inspect the remote version, or use force push only if this install should replace it.',
      };
    case 'in_sync':
      return {
        label: 'Sync Is Healthy',
        detail: 'Local and remote snapshots match. Probe again later if you want a fresh remote check.',
      };
    default:
      return {
        label: 'Check Remote',
        detail: 'Probe or pull the provider to learn whether the remote snapshot exists and how it compares.',
      };
  }
}

export function pushManualCompanionSyncPayload(raw: string): CompanionSyncSnapshot {
  const timestamp = Date.now();
  saveToStorage(MANUAL_SYNC_PAYLOAD_KEY, raw);
  return saveCompanionSyncSnapshot({
    provider: 'manual',
    lastPushedAt: timestamp,
    lastFingerprint: buildCompanionFingerprint(raw),
  });
}

export function pullManualCompanionSyncPayload(): string | null {
  const raw = loadFromStorage<string | null>(MANUAL_SYNC_PAYLOAD_KEY, null);
  if (!raw) return null;
  saveCompanionSyncSnapshot({
    provider: 'manual',
    lastPulledAt: Date.now(),
    lastFingerprint: buildCompanionFingerprint(raw),
  });
  return raw;
}
