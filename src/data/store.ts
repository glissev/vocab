import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';
import { applyAnswer, type Direction } from '../lib/leitner';
import { normalize } from '../lib/text';
import { DEFAULT_PROFILE, type Entry, type EntryDraft, type Profile } from '../lib/types';

/*
 * Firestore layout
 *   users/{uid}                 -> Profile
 *   users/{uid}/entries/{id}    -> Entry (without id)
 * Writes are not awaited by the UI: with the offline cache they apply locally at once
 * and sync in the background, so the app works the same with or without a connection.
 */

const entriesCol = (uid: string) => collection(db, 'users', uid, 'entries');
const entryDoc = (uid: string, id: string) => doc(db, 'users', uid, 'entries', id);
const profileDoc = (uid: string) => doc(db, 'users', uid);

function report(err: unknown) {
  console.error('[vocab] Firestore write failed', err);
}

function toEntry(id: string, data: DocumentData): Entry {
  return {
    id,
    a: data.a ?? [],
    b: data.b ?? [],
    aNorm: data.aNorm ?? [],
    bNorm: data.bNorm ?? [],
    note: data.note ?? '',
    tags: data.tags ?? [],
    createdAt: data.createdAt ?? 0,
    updatedAt: data.updatedAt ?? 0,
    review: data.review ?? {},
  };
}

/* ---------- profile ---------- */

export type ProfileState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; profile: Profile };

export function useProfile(uid: string): ProfileState {
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  useEffect(() => {
    return onSnapshot(
      profileDoc(uid),
      (snap) => {
        if (!snap.exists()) return setState({ status: 'missing' });
        setState({ status: 'ready', profile: { ...DEFAULT_PROFILE, createdAt: 0, ...(snap.data() as Partial<Profile>) } });
      },
      (err) => {
        console.error(err);
        setState({ status: 'missing' });
      },
    );
  }, [uid]);
  return state;
}

export function saveProfile(uid: string, patch: Partial<Profile>) {
  setDoc(profileDoc(uid), patch, { merge: true }).catch(report);
}

/* ---------- entries ---------- */

export interface EntriesState {
  entries: Entry[];
  loading: boolean;
  /** True while showing cached data that has not been confirmed by the server yet. */
  fromCache: boolean;
  error: string | null;
}

export function useEntries(uid: string): EntriesState {
  const [state, setState] = useState<EntriesState>({ entries: [], loading: true, fromCache: false, error: null });
  useEffect(() => {
    return onSnapshot(
      entriesCol(uid),
      { includeMetadataChanges: true },
      (snap) => {
        const entries = snap.docs.map((d) => toEntry(d.id, d.data()));
        entries.sort((x, y) => y.createdAt - x.createdAt);
        setState({ entries, loading: false, fromCache: snap.metadata.fromCache, error: null });
      },
      (err) => setState((s) => ({ ...s, loading: false, error: err.message })),
    );
  }, [uid]);
  return state;
}

function withNorms(draft: EntryDraft) {
  return {
    a: draft.a,
    b: draft.b,
    aNorm: draft.a.map(normalize),
    bNorm: draft.b.map(normalize),
    note: draft.note.trim(),
    tags: draft.tags,
  };
}

export function addEntry(uid: string, draft: EntryDraft): string {
  const ref = doc(entriesCol(uid));
  const now = Date.now();
  setDoc(ref, { ...withNorms(draft), createdAt: now, updatedAt: now, review: {} }).catch(report);
  return ref.id;
}

export function updateEntry(uid: string, id: string, draft: EntryDraft) {
  updateDoc(entryDoc(uid, id), { ...withNorms(draft), updatedAt: Date.now() }).catch(report);
}

export function deleteEntry(uid: string, id: string) {
  deleteDoc(entryDoc(uid, id)).catch(report);
}

export function recordAnswer(uid: string, entry: Entry, direction: Direction, correct: boolean) {
  const next = applyAnswer(entry.review?.[direction], correct);
  updateDoc(entryDoc(uid, entry.id), { [`review.${direction}`]: next }).catch(report);
}

/**
 * Imports many entries in batches (Firestore allows 500 writes per batch).
 * Not awaited: like other writes, the batch applies to the local cache at once
 * and syncs when online.
 */
export function importEntries(uid: string, drafts: EntryDraft[]) {
  const now = Date.now();
  for (let i = 0; i < drafts.length; i += 400) {
    const batch = writeBatch(db);
    drafts.slice(i, i + 400).forEach((draft, j) => {
      batch.set(doc(entriesCol(uid)), { ...withNorms(draft), createdAt: now + i + j, updatedAt: now, review: {} });
    });
    batch.commit().catch(report);
  }
}

/* ---------- duplicate detection ---------- */

/** True when an entry already holds the same pair (overlap on both sides). Used by import. */
export function isSamePair(entry: Pick<Entry, 'aNorm' | 'bNorm'>, draft: EntryDraft): boolean {
  const a = draft.a.map(normalize);
  const b = draft.b.map(normalize);
  return entry.aNorm.some((n) => a.includes(n)) && entry.bNorm.some((n) => b.includes(n));
}

/** Existing entries sharing any normalised variant with the draft, on the same side. */
export function findDuplicates(entries: Entry[], draft: EntryDraft, ignoreId?: string): Entry[] {
  const a = new Set(draft.a.map(normalize));
  const b = new Set(draft.b.map(normalize));
  return entries.filter(
    (e) => e.id !== ignoreId && (e.aNorm.some((n) => a.has(n)) || e.bNorm.some((n) => b.has(n))),
  );
}
