import type { Profile } from '@/types';
import { loadFromStorage, saveToStorage, generateId } from '@/utils';

const STORAGE_KEY = 'wm-companion-profile-v1';
const listeners = new Set<() => void>();

const DEFAULT_PROFILE: Profile = {
  id: generateId(),
  displayName: 'Local User',
  preferredLanguage: 'en',
  preferredBriefTone: 'balanced',
  syncMode: 'local',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export function loadProfile(): Profile {
  const profile = loadFromStorage<Profile>(STORAGE_KEY, DEFAULT_PROFILE);
  return {
    ...DEFAULT_PROFILE,
    ...profile,
  };
}

export function saveProfile(partial: Partial<Omit<Profile, 'id' | 'createdAt'>>): Profile {
  const current = loadProfile();
  const next: Profile = {
    ...current,
    ...partial,
    updatedAt: Date.now(),
  };
  saveToStorage(STORAGE_KEY, next);
  for (const listener of listeners) listener();
  return next;
}

export function subscribeProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
