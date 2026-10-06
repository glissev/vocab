/**
 * Leitner spaced-repetition schedule, tracked separately per direction
 * (recognising a word and producing it are different skills).
 *
 * box 0 = never quizzed (always due)
 * correct  -> move up one box (max 5), next review after that box's interval
 * wrong    -> back to box 1, due again in 10 minutes
 */

export type Direction = 'a2b' | 'b2a';

export interface ReviewState {
  box: number;
  /** Epoch milliseconds. */
  dueAt: number;
  right: number;
  wrong: number;
  lastAt?: number;
}

export const MAX_BOX = 5;
const DAY = 24 * 60 * 60 * 1000;
const RETRY_AFTER_WRONG = 10 * 60 * 1000;

/** Days until the next review once a word reaches the given box. */
export const BOX_INTERVAL_DAYS: Record<number, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

export function emptyReview(): ReviewState {
  return { box: 0, dueAt: 0, right: 0, wrong: 0 };
}

export function applyAnswer(state: ReviewState | undefined, correct: boolean, now = Date.now()): ReviewState {
  const prev = state ?? emptyReview();
  if (correct) {
    const box = Math.min(prev.box + 1, MAX_BOX);
    return { box, dueAt: now + BOX_INTERVAL_DAYS[box] * DAY, right: prev.right + 1, wrong: prev.wrong, lastAt: now };
  }
  return { box: 1, dueAt: now + RETRY_AFTER_WRONG, right: prev.right, wrong: prev.wrong + 1, lastAt: now };
}

export function isDue(state: ReviewState | undefined, now = Date.now()): boolean {
  return !state || state.dueAt <= now;
}
