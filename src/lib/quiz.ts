import { isDue, type Direction } from './leitner';
import { isComplete, type Entry } from './types';

export type DirectionMode = Direction | 'mixed';
export type QuizSource = 'due' | 'all' | 'tag' | 'recent';

export interface QuizOptions {
  direction: DirectionMode;
  source: QuizSource;
  tag?: string;
  size: number;
}

export interface QuizItem {
  entryId: string;
  direction: Direction;
  /** The word shown to the user. */
  prompt: string;
  /** Every variant accepted as a correct answer. */
  accepted: string[];
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function directionsFor(mode: DirectionMode): Direction[] {
  return mode === 'mixed' ? ['a2b', 'b2a'] : [mode];
}

export function makeItem(entry: Entry, direction: Direction, rng: () => number = Math.random): QuizItem {
  const promptSide = direction === 'a2b' ? entry.a : entry.b;
  const answerSide = direction === 'a2b' ? entry.b : entry.a;
  return {
    entryId: entry.id,
    direction,
    prompt: promptSide[Math.floor(rng() * promptSide.length)],
    accepted: answerSide,
  };
}

/** Entries that can be quizzed for the chosen source, before size limiting. */
export function eligibleEntries(entries: Entry[], options: Omit<QuizOptions, 'size'>, now = Date.now()): Entry[] {
  const dirs = directionsFor(options.direction);
  return entries.filter((e) => {
    if (!isComplete(e)) return false;
    switch (options.source) {
      case 'due':
        return dirs.some((d) => isDue(e.review?.[d], now));
      case 'tag':
        return !!options.tag && e.tags.includes(options.tag);
      case 'recent':
        return now - e.createdAt <= WEEK;
      case 'all':
        return true;
    }
  });
}

/**
 * Builds a quiz session. Each entry appears at most once.
 * "due" picks the most overdue words first (never-quizzed words count as due now);
 * other sources are shuffled.
 */
export function buildQuiz(entries: Entry[], options: QuizOptions, now = Date.now(), rng: () => number = Math.random): QuizItem[] {
  const dirs = directionsFor(options.direction);
  const pool = eligibleEntries(entries, options, now);

  if (options.source === 'due') {
    const candidates = shuffle(pool, rng).map((entry) => {
      const due = dirs.filter((d) => isDue(entry.review?.[d], now));
      const direction = due.length === 1 ? due[0] : due[Math.floor(rng() * due.length)];
      const dueAt = entry.review?.[direction]?.dueAt ?? 0;
      return { entry, direction, dueAt };
    });
    candidates.sort((x, y) => x.dueAt - y.dueAt);
    return candidates.slice(0, options.size).map((c) => makeItem(c.entry, c.direction, rng));
  }

  return shuffle(pool, rng)
    .slice(0, options.size)
    .map((entry) => makeItem(entry, dirs[Math.floor(rng() * dirs.length)], rng));
}
