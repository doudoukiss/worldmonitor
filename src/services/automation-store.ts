import type { AutomationRule } from '@/types';
import { generateId, loadFromStorage, saveToStorage } from '@/utils';

const STORAGE_KEY = 'wm-companion-automation-v1';
const listeners = new Set<() => void>();

interface AutomationStoreSnapshot {
  rules: AutomationRule[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: AutomationStoreSnapshot = {
  rules: [],
  updatedAt: 0,
};

function cloneRule(rule: AutomationRule): AutomationRule {
  return {
    ...rule,
    minimumScore: typeof rule.minimumScore === 'number' ? rule.minimumScore : 60,
    mutedUntil: typeof rule.mutedUntil === 'number' ? rule.mutedUntil : null,
  };
}

function loadSnapshot(): AutomationStoreSnapshot {
  const snapshot = loadFromStorage<AutomationStoreSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
  return {
    rules: Array.isArray(snapshot.rules) ? snapshot.rules.map(cloneRule) : [],
    updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : 0,
  };
}

function saveSnapshot(snapshot: AutomationStoreSnapshot): void {
  saveToStorage(STORAGE_KEY, {
    rules: snapshot.rules.map(cloneRule),
    updatedAt: snapshot.updatedAt,
  });
  for (const listener of listeners) listener();
}

export function loadAutomationStoreSnapshot(): AutomationStoreSnapshot {
  return loadSnapshot();
}

export function saveAutomationStoreSnapshot(snapshot: AutomationStoreSnapshot): void {
  saveSnapshot(snapshot);
}

export function listAutomationRules(workspaceId?: string): AutomationRule[] {
  const snapshot = loadSnapshot();
  const rules = workspaceId
    ? snapshot.rules.filter((rule) => rule.workspaceId === workspaceId)
    : snapshot.rules;
  return [...rules].map(cloneRule).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveAutomationRule(
  input: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): AutomationRule {
  const snapshot = loadSnapshot();
  const timestamp = Date.now();
  const existing = input.id
    ? snapshot.rules.find((rule) => rule.id === input.id) ?? null
    : null;

  const rule: AutomationRule = {
    id: existing?.id ?? generateId(),
    workspaceId: input.workspaceId,
    name: input.name,
    enabled: input.enabled,
    trigger: input.trigger,
    action: input.action,
    minimumScore: input.minimumScore,
    mutedUntil: typeof input.mutedUntil === 'number' ? input.mutedUntil : null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  const nextRules = existing
    ? snapshot.rules.map((entry) => entry.id === rule.id ? rule : entry)
    : [rule, ...snapshot.rules];

  saveSnapshot({
    rules: nextRules,
    updatedAt: timestamp,
  });

  return rule;
}

export function deleteAutomationRule(ruleId: string): void {
  const snapshot = loadSnapshot();
  saveSnapshot({
    rules: snapshot.rules.filter((rule) => rule.id !== ruleId),
    updatedAt: Date.now(),
  });
}

export function toggleAutomationRule(ruleId: string, enabled: boolean): void {
  const snapshot = loadSnapshot();
  const timestamp = Date.now();
  saveSnapshot({
    rules: snapshot.rules.map((rule) => (
      rule.id === ruleId
        ? { ...rule, enabled, updatedAt: timestamp }
        : rule
    )),
    updatedAt: timestamp,
  });
}

export function snoozeAutomationRule(ruleId: string, durationMs = 24 * 60 * 60 * 1000): void {
  const snapshot = loadSnapshot();
  const timestamp = Date.now();
  saveSnapshot({
    rules: snapshot.rules.map((rule) => (
      rule.id === ruleId
        ? { ...rule, mutedUntil: timestamp + durationMs, updatedAt: timestamp }
        : rule
    )),
    updatedAt: timestamp,
  });
}

export function resumeAutomationRule(ruleId: string): void {
  const snapshot = loadSnapshot();
  const timestamp = Date.now();
  saveSnapshot({
    rules: snapshot.rules.map((rule) => (
      rule.id === ruleId
        ? { ...rule, mutedUntil: null, updatedAt: timestamp }
        : rule
    )),
    updatedAt: timestamp,
  });
}

export function subscribeAutomationRules(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
