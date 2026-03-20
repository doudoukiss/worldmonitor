import { type MarketWatchlistEntry } from '@/services/market-watchlist';
import {
  DEFAULT_WORKSPACE_ID,
  cloneWorkspace,
  cloneWorkspaceFollow,
  cloneWorkspacePanelSettings,
  getWorkspaceTemplateLabel,
  loadWorkspaceStoreSnapshot,
  saveWorkspaceStoreSnapshot,
  sortWorkspacesByUpdatedAt,
} from '@/services/workspace-store';
import { generateId } from '@/utils';
import type {
  Follow,
  MapLayers,
  Monitor,
  Workspace,
  WorkspaceTemplateId,
} from '@/types';

function buildMonitorFollows(monitors: Monitor[], timestamp: number): Follow[] {
  return monitors.map((monitor) => {
    const keywords = monitor.keywords.map((keyword) => keyword.trim()).filter(Boolean);
    return {
      id: `follow-monitor:${monitor.id}`,
      kind: 'keyword_set',
      label: keywords.join(', '),
      query: keywords.join(', '),
      source: 'legacy-monitor',
      keywords,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

function buildWatchlistFollows(entries: MarketWatchlistEntry[], timestamp: number): Follow[] {
  return entries.map((entry) => ({
    id: `follow-market:${entry.symbol}`,
    kind: 'ticker',
    label: entry.name || entry.symbol,
    query: entry.symbol,
    source: 'legacy-watchlist',
    symbol: entry.symbol,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function mergeLegacyFollows(existing: Follow[], legacyFollows: Follow[]): Follow[] {
  const manual = existing.filter((follow) => follow.source === 'manual');
  return [...legacyFollows, ...manual];
}

export interface LegacyWorkspaceSeed {
  template: WorkspaceTemplateId;
  monitors: Monitor[];
  marketWatchlist: MarketWatchlistEntry[];
  panelSettings: Workspace['panelSettings'];
  mapLayers: MapLayers;
}

export class WorkspaceStore {
  private snapshot = loadWorkspaceStoreSnapshot();
  private listeners = new Set<() => void>();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public listWorkspaces(): Workspace[] {
    return sortWorkspacesByUpdatedAt(this.snapshot.workspaces).map(cloneWorkspace);
  }

  public getWorkspace(id: string | null | undefined): Workspace | null {
    if (!id) return null;
    const workspace = this.snapshot.workspaces.find((entry) => entry.id === id);
    return workspace ? cloneWorkspace(workspace) : null;
  }

  public getActiveWorkspace(activeWorkspaceId: string | null | undefined): Workspace | null {
    return this.getWorkspace(activeWorkspaceId) ?? this.getWorkspace(DEFAULT_WORKSPACE_ID);
  }

  public createWorkspace(
    name: string,
    seed: Pick<Workspace, 'template' | 'panelSettings' | 'mapLayers'>
      & Partial<Pick<Workspace, 'follows' | 'description'>>,
  ): Workspace {
    const timestamp = Date.now();
    const workspace: Workspace = {
      id: generateId(),
      name: name.trim() || 'New workspace',
      template: seed.template,
      description: seed.description || '',
      legacyBacked: false,
      follows: (seed.follows ?? []).map(cloneWorkspaceFollow),
      pinnedPanelIds: Object.keys(seed.panelSettings).filter((key) => seed.panelSettings[key]?.enabled).slice(0, 12),
      panelSettings: cloneWorkspacePanelSettings(seed.panelSettings),
      mapLayers: { ...seed.mapLayers },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.commit([...this.snapshot.workspaces, workspace]);
    return workspace;
  }

  public updateWorkspace(
    workspaceId: string,
    partial: Partial<Pick<Workspace, 'name' | 'description' | 'follows' | 'pinnedPanelIds' | 'panelSettings' | 'mapLayers'>>,
  ): Workspace | null {
    const existing = this.getWorkspace(workspaceId);
    if (!existing) return null;

    const nextWorkspace: Workspace = {
      ...existing,
      ...partial,
      follows: partial.follows ? partial.follows.map(cloneWorkspaceFollow) : existing.follows,
      panelSettings: partial.panelSettings ? cloneWorkspacePanelSettings(partial.panelSettings) : existing.panelSettings,
      mapLayers: partial.mapLayers ? { ...partial.mapLayers } : existing.mapLayers,
      pinnedPanelIds: partial.pinnedPanelIds ? [...partial.pinnedPanelIds] : existing.pinnedPanelIds,
      updatedAt: Date.now(),
    };

    this.commit(
      this.snapshot.workspaces.map((workspace) => workspace.id === workspaceId ? nextWorkspace : workspace),
    );
    return nextWorkspace;
  }

  public deleteWorkspace(workspaceId: string): boolean {
    const existing = this.getWorkspace(workspaceId);
    if (!existing || existing.id === DEFAULT_WORKSPACE_ID || existing.legacyBacked) {
      return false;
    }

    this.commit(
      this.snapshot.workspaces.filter((workspace) => workspace.id !== workspaceId),
    );
    return true;
  }

  public ensureDefaultWorkspace(seed: LegacyWorkspaceSeed): Workspace {
    const timestamp = Date.now();
    const legacyFollows = [
      ...buildMonitorFollows(seed.monitors, timestamp),
      ...buildWatchlistFollows(seed.marketWatchlist, timestamp),
    ];

    const existing = this.getWorkspace(DEFAULT_WORKSPACE_ID);
    const templateLabel = getWorkspaceTemplateLabel(seed.template);

    const nextWorkspace: Workspace = {
      id: DEFAULT_WORKSPACE_ID,
      name: existing?.name || `${templateLabel} workspace`,
      template: seed.template,
      description: existing?.description || 'Legacy-backed starter workspace derived from your current dashboard setup.',
      legacyBacked: true,
      follows: mergeLegacyFollows(existing?.follows ?? [], legacyFollows),
      pinnedPanelIds: Object.keys(seed.panelSettings)
        .filter((key) => seed.panelSettings[key]?.enabled)
        .slice(0, 12),
      panelSettings: cloneWorkspacePanelSettings(seed.panelSettings),
      mapLayers: { ...seed.mapLayers },
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };

    const nextWorkspaces = existing
      ? this.snapshot.workspaces.map((workspace) => workspace.id === DEFAULT_WORKSPACE_ID ? nextWorkspace : workspace)
      : [...this.snapshot.workspaces, nextWorkspace];

    this.commit(nextWorkspaces);
    return nextWorkspace;
  }

  public replaceSnapshot(snapshot: { workspaces: Workspace[]; updatedAt?: number }): void {
    this.snapshot = {
      workspaces: snapshot.workspaces.map(cloneWorkspace),
      updatedAt: snapshot.updatedAt ?? Date.now(),
    };
    saveWorkspaceStoreSnapshot(this.snapshot);
    for (const listener of this.listeners) listener();
  }

  private commit(workspaces: Workspace[]): void {
    this.snapshot = {
      workspaces: workspaces.map(cloneWorkspace),
      updatedAt: Date.now(),
    };
    saveWorkspaceStoreSnapshot(this.snapshot);
    for (const listener of this.listeners) listener();
  }
}
