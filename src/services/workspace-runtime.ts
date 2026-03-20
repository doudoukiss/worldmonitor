import { STORAGE_KEYS } from '@/config';
import type { Workspace } from '@/types';
import { saveToStorage } from '@/utils';

function cloneWorkspacePanelSettings(workspace: Workspace): Workspace['panelSettings'] {
  return Object.fromEntries(
    Object.entries(workspace.panelSettings).map(([key, value]) => [key, { ...value }]),
  );
}

export function persistWorkspaceRuntimeState(workspace: Workspace): void {
  saveToStorage(STORAGE_KEYS.panels, cloneWorkspacePanelSettings(workspace));
  saveToStorage(STORAGE_KEYS.mapLayers, { ...workspace.mapLayers });
}

export function activateWorkspaceRuntime(workspace: Workspace): void {
  persistWorkspaceRuntimeState(workspace);
  window.location.reload();
}
