import type { BriefRecipe, BriefRun, Workspace } from '@/types';
import { loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-briefing-v1';
const MAX_RUNS = 120;

interface BriefingStoreSnapshot {
  recipes: BriefRecipe[];
  runs: BriefRun[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: BriefingStoreSnapshot = {
  recipes: [],
  runs: [],
  updatedAt: 0,
};

export class BriefingStore {
  private snapshot: BriefingStoreSnapshot = loadFromStorage<BriefingStoreSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  private listeners = new Set<() => void>();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public listRecipes(workspaceId: string): BriefRecipe[] {
    return this.snapshot.recipes
      .filter((recipe) => recipe.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public listRuns(workspaceId: string): BriefRun[] {
    return this.snapshot.runs
      .filter((run) => run.workspaceId === workspaceId)
      .sort((a, b) => b.generatedAt - a.generatedAt);
  }

  public listRunsForRecipe(recipeId: string): BriefRun[] {
    return this.snapshot.runs
      .filter((run) => run.recipeId === recipeId)
      .sort((a, b) => b.generatedAt - a.generatedAt);
  }

  public getRecipe(recipeId: string): BriefRecipe | null {
    return this.snapshot.recipes.find((recipe) => recipe.id === recipeId) ?? null;
  }

  public getLatestRun(recipeId: string): BriefRun | null {
    return this.listRunsForRecipe(recipeId)[0] ?? null;
  }

  public findReusableRun(recipeId: string, inputSignature: string): BriefRun | null {
    return this.snapshot.runs.find((run) => (
      run.recipeId === recipeId
        && run.inputSignature === inputSignature
        && run.status === 'ready'
    )) ?? null;
  }

  public saveRun(run: BriefRun): void {
    const nextRuns = [
      run,
      ...this.snapshot.runs.filter((existing) => (
        existing.id !== run.id
          && !(existing.recipeId === run.recipeId && existing.inputSignature === run.inputSignature)
      )),
    ].slice(0, MAX_RUNS);

    this.snapshot = {
      ...this.snapshot,
      runs: nextRuns,
      updatedAt: Date.now(),
    };
    saveToStorage(STORAGE_KEY, this.snapshot);
    for (const listener of this.listeners) listener();
  }

  public ensureDefaultRecipes(workspace: Workspace): void {
    const timestamp = Date.now();
    const wanted: BriefRecipe[] = [
      {
        id: `brief:${workspace.id}:workspace_morning`,
        workspaceId: workspace.id,
        kind: 'workspace_morning',
        title: `${workspace.name} morning brief`,
        promptHint: 'Summarize the most important new signals for this workspace.',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: `brief:${workspace.id}:workspace_delta`,
        workspaceId: workspace.id,
        kind: 'workspace_delta',
        title: `${workspace.name} what changed`,
        promptHint: 'Explain what changed since the last visit for this workspace.',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];

    const existingById = new Map(this.snapshot.recipes.map((recipe) => [recipe.id, recipe]));
    const nextRecipes = [...this.snapshot.recipes];
    let changed = false;
    for (const recipe of wanted) {
      if (existingById.has(recipe.id)) continue;
      nextRecipes.push(recipe);
      changed = true;
    }
    if (!changed) return;

    this.snapshot = {
      ...this.snapshot,
      recipes: nextRecipes,
      updatedAt: timestamp,
    };
    saveToStorage(STORAGE_KEY, this.snapshot);
    for (const listener of this.listeners) listener();
  }

  public exportSnapshot(): BriefingStoreSnapshot {
    return {
      recipes: [...this.snapshot.recipes],
      runs: [...this.snapshot.runs],
      updatedAt: this.snapshot.updatedAt,
    };
  }

  public replaceSnapshot(snapshot: Partial<BriefingStoreSnapshot>): void {
    this.snapshot = {
      recipes: Array.isArray(snapshot.recipes) ? [...snapshot.recipes] : [],
      runs: Array.isArray(snapshot.runs) ? [...snapshot.runs].slice(0, MAX_RUNS) : [],
      updatedAt: snapshot.updatedAt ?? Date.now(),
    };
    saveToStorage(STORAGE_KEY, this.snapshot);
    for (const listener of this.listeners) listener();
  }
}
