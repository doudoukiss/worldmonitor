import { SITE_VARIANT } from '@/config';
import {
  RUNTIME_FEATURES,
  getRuntimeConfigSnapshot,
  type RuntimeFeatureId,
  type RuntimeSecretKey,
} from '@/services/runtime-config';
import { isDesktopRuntime } from '@/services/runtime';
import { loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-session-v1';

export interface SessionSnapshot {
  activeWorkspaceId: string | null;
  previousVisitedAt: number | null;
  lastVisitedAt: number | null;
  currentVariant: string;
  runtimeMode: 'desktop' | 'browser';
  presentSecretKeys: RuntimeSecretKey[];
  availableFeatureIds: RuntimeFeatureId[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: SessionSnapshot = {
  activeWorkspaceId: null,
  previousVisitedAt: null,
  lastVisitedAt: null,
  currentVariant: SITE_VARIANT,
  runtimeMode: isDesktopRuntime() ? 'desktop' : 'browser',
  presentSecretKeys: [],
  availableFeatureIds: [],
  updatedAt: 0,
};

export class SessionStore {
  private snapshot: SessionSnapshot = loadFromStorage<SessionSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  private listeners = new Set<() => void>();

  constructor() {
    this.refreshRuntimeState();
  }

  public getSnapshot(): SessionSnapshot {
    return {
      ...this.snapshot,
      presentSecretKeys: [...this.snapshot.presentSecretKeys],
      availableFeatureIds: [...this.snapshot.availableFeatureIds],
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public setActiveWorkspaceId(workspaceId: string | null): void {
    if (this.snapshot.activeWorkspaceId === workspaceId) return;
    this.commit({
      activeWorkspaceId: workspaceId,
    });
  }

  public markVisit(timestamp = Date.now()): void {
    this.commit({
      previousVisitedAt: this.snapshot.lastVisitedAt,
      lastVisitedAt: timestamp,
    });
  }

  public refreshRuntimeState(): void {
    const runtimeConfig = getRuntimeConfigSnapshot();
    const presentSecretKeys = Object.keys(runtimeConfig.secrets)
      .filter((key): key is RuntimeSecretKey => Boolean(runtimeConfig.secrets[key as RuntimeSecretKey]?.value))
      .sort();

    const presentSet = new Set<RuntimeSecretKey>(presentSecretKeys);
    const availableFeatureIds = RUNTIME_FEATURES
      .filter((feature) => {
        if (runtimeConfig.featureToggles[feature.id] === false) return false;
        return feature.requiredSecrets.every((secret) => presentSet.has(secret));
      })
      .map((feature) => feature.id);

    this.commit({
      currentVariant: SITE_VARIANT,
      runtimeMode: isDesktopRuntime() ? 'desktop' : 'browser',
      presentSecretKeys,
      availableFeatureIds,
    });
  }

  public replaceSnapshot(snapshot: Partial<SessionSnapshot>): void {
    this.commit({
      activeWorkspaceId: snapshot.activeWorkspaceId ?? null,
      previousVisitedAt: snapshot.previousVisitedAt ?? null,
      lastVisitedAt: snapshot.lastVisitedAt ?? null,
      currentVariant: snapshot.currentVariant ?? SITE_VARIANT,
    });
    this.refreshRuntimeState();
  }

  private commit(partial: Partial<SessionSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...partial,
      updatedAt: Date.now(),
    };
    saveToStorage(STORAGE_KEY, this.snapshot);
    for (const listener of this.listeners) listener();
  }
}
