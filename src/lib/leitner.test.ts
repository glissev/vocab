import { describe, expect, it } from 'vitest';
import { applyAnswer, BOX_INTERVAL_DAYS, isDue, MAX_BOX } from './leitner';

const DAY = 86_400_000;
const now = 1_700_000_000_000;

describe('leitner', () => {
  it('moves a new word to box 1, due in one day', () => {
    const s = applyAnswer(undefined, true, now);
    expect(s.box).toBe(1);
    expect(s.dueAt).toBe(now + BOX_INTERVAL_DAYS[1] * DAY);
    expect(s.right).toBe(1);
  });
  it('caps at the top box', () => {
    const s = applyAnswer({ box: MAX_BOX, dueAt: 0, right: 9, wrong: 0 }, true, now);
    expect(s.box).toBe(MAX_BOX);
  });
  it('sends wrong answers back to box 1, due soon', () => {
    const s = applyAnswer({ box: 4, dueAt: 0, right: 5, wrong: 0 }, false, now);
    expect(s.box).toBe(1);
    expect(s.wrong).toBe(1);
    expect(s.dueAt - now).toBeLessThan(DAY);
  });
  it('treats missing state as due', () => {
    expect(isDue(undefined, now)).toBe(true);
    expect(isDue({ box: 2, dueAt: now + 1, right: 1, wrong: 0 }, now)).toBe(false);
  });
});
