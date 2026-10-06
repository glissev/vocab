import type { Direction, ReviewState } from './leitner';

export interface Entry {
  id: string;
  /** Side A variants, e.g. ["ябълка"]. Empty array = not filled in yet. */
  a: string[];
  /** Side B variants, e.g. ["사과"]. */
  b: string[];
  /** Normalised copies of a/b (see normalize()) for duplicate checks. */
  aNorm: string[];
  bNorm: string[];
  note: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  review: Partial<Record<Direction, ReviewState>>;
}

export type EntryDraft = Pick<Entry, 'a' | 'b' | 'note' | 'tags'>;

export interface Profile {
  langA: string;
  langB: string;
  quizSize: number;
  typoTolerance: boolean;
  createdAt: number;
}

export const DEFAULT_PROFILE: Omit<Profile, 'createdAt'> = {
  langA: 'bg',
  langB: 'ko',
  quizSize: 20,
  typoTolerance: true,
};

export function isComplete(entry: Pick<Entry, 'a' | 'b'>): boolean {
  return entry.a.length > 0 && entry.b.length > 0;
}
