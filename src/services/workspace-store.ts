import type { Follow, PanelConfig, Workspace, WorkspaceTemplateId } from '@/types';
import { loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-workspaces-v1';
const WORKSPACE_TEMPLATES = new Set<WorkspaceTemplateId>([
  'full',
  'tech',
  'finance',
  'happy',
  'commodity',
  'custom',
]);

const TEMPLATE_LABELS: Record<Exclude<WorkspaceTemplateId, 'custom'>, string> = {
  full: 'Global intelligence',
  tech: 'Technology',
  finance: 'Markets',
  happy: 'Positive signals',
  commodity: 'Commodities',
};

export const DEFAULT_WORKSPACE_ID = 'wm-workspace-default';

export interface WorkspaceStoreSnapshot {
  workspaces: Workspace[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: WorkspaceStoreSnapshot = {
  workspaces: [],
  updatedAt: 0,
};

export function coerceWorkspaceTemplateId(value: string): WorkspaceTemplateId {
  return WORKSPACE_TEMPLATES.has(value as WorkspaceTemplateId)
    ? (value as WorkspaceTemplateId)
    : 'custom';
}

export function getWorkspaceTemplateLabel(template: WorkspaceTemplateId): string {
  if (template === 'custom') return 'Personal workspace';
  return TEMPLATE_LABELS[template] ?? 'Personal workspace';
}

export function cloneWorkspacePanelSettings(
  panelSettings: Record<string, PanelConfig>,
): Record<string, PanelConfig> {
  return Object.fromEntries(
    Object.entries(panelSettings).map(([key, value]) => [key, { ...value }]),
  );
}

export function cloneWorkspaceFollow(follow: Follow): Follow {
  return {
    ...follow,
    keywords: follow.keywords ? [...follow.keywords] : undefined,
  };
}

export function cloneWorkspace(workspace: Workspace): Workspace {
  return {
    ...workspace,
    follows: workspace.follows.map(cloneWorkspaceFollow),
    pinnedPanelIds: [...workspace.pinnedPanelIds],
    panelSettings: cloneWorkspacePanelSettings(workspace.panelSettings),
    mapLayers: { ...workspace.mapLayers },
  };
}

export function sortWorkspacesByUpdatedAt(workspaces: Workspace[]): Workspace[] {
  return [...workspaces].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadWorkspaceStoreSnapshot(): WorkspaceStoreSnapshot {
  const snapshot = loadFromStorage<WorkspaceStoreSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  return {
    workspaces: Array.isArray(snapshot.workspaces)
      ? snapshot.workspaces.map(cloneWorkspace)
      : [],
    updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : 0,
  };
}

export function saveWorkspaceStoreSnapshot(snapshot: WorkspaceStoreSnapshot): void {
  saveToStorage(STORAGE_KEY, {
    workspaces: snapshot.workspaces.map(cloneWorkspace),
    updatedAt: snapshot.updatedAt,
  });
}
