import type { MemoryNote } from '@/types';
import { loadFromStorage, saveToStorage, generateId } from '@/utils';

const STORAGE_KEY = 'wm-companion-notes-v1';
const listeners = new Set<() => void>();

interface NoteStoreSnapshot {
  notes: MemoryNote[];
  updatedAt: number;
}

const DEFAULT_SNAPSHOT: NoteStoreSnapshot = {
  notes: [],
  updatedAt: 0,
};

function cloneNote(note: MemoryNote): MemoryNote {
  return {
    ...note,
    tags: Array.isArray(note.tags) ? [...note.tags] : [],
    linkedItemIds: Array.isArray(note.linkedItemIds) ? [...note.linkedItemIds] : [],
    linkedFollowIds: Array.isArray(note.linkedFollowIds) ? [...note.linkedFollowIds] : [],
  };
}

function loadSnapshot(): NoteStoreSnapshot {
  return loadFromStorage<NoteStoreSnapshot>(STORAGE_KEY, DEFAULT_SNAPSHOT);
}

function saveSnapshot(snapshot: NoteStoreSnapshot): void {
  saveToStorage(STORAGE_KEY, snapshot);
  for (const listener of listeners) listener();
}

export function loadNoteStoreSnapshot(): NoteStoreSnapshot {
  return loadSnapshot();
}

export function saveNoteStoreSnapshot(snapshot: NoteStoreSnapshot): void {
  saveSnapshot(snapshot);
}

export function listNotes(workspaceId?: string): MemoryNote[] {
  const snapshot = loadSnapshot();
  const notes = workspaceId
    ? snapshot.notes.filter((note) => note.workspaceId === workspaceId)
    : snapshot.notes;
  return [...notes].map(cloneNote).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveNote(
  input: Omit<MemoryNote, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): MemoryNote {
  const snapshot = loadSnapshot();
  const timestamp = Date.now();
  const existing = input.id
    ? snapshot.notes.find((note) => note.id === input.id) ?? null
    : null;

  const note: MemoryNote = {
    id: existing?.id ?? generateId(),
    workspaceId: input.workspaceId,
    title: input.title,
    body: input.body,
    tags: Array.isArray(input.tags) ? [...input.tags] : [],
    linkedItemIds: Array.isArray(input.linkedItemIds) ? [...input.linkedItemIds] : [],
    linkedFollowIds: Array.isArray(input.linkedFollowIds) ? [...input.linkedFollowIds] : [],
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  const nextNotes = existing
    ? snapshot.notes.map((entry) => entry.id === note.id ? note : entry)
    : [note, ...snapshot.notes];

  saveSnapshot({
    notes: nextNotes,
    updatedAt: timestamp,
  });
  return note;
}

export function deleteNote(noteId: string): void {
  const snapshot = loadSnapshot();
  saveSnapshot({
    notes: snapshot.notes.filter((note) => note.id !== noteId),
    updatedAt: Date.now(),
  });
}

export function subscribeNotes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
