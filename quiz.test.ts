import { describe, expect, it } from 'vitest';
import { buildQuiz, eligibleEntries } from './quiz';
import type { Entry } from './types';

const now = 1_700_000_000_000;
const DAY = 86_400_000;

function entry(id: string, over: Partial<Entry> = {}): Entry {
  return {
    id,
    a: ['a-' + id],
    b: ['b-' + id],
    aNorm: [],
    bNorm: [],
    note: '',
    tags: [],
    createdAt: now - 30 * DAY,
    updatedAt: now,
    review: {},
    ...over,
  };
}

const seeded = () => {
  let x = 42;
  return () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
};

describe('buildQuiz', () => {
  it('skips entries missing a side', () => {
    const list = [entry('1'), entry('2', { b: [] })];
    expect(eligibleEntries(list, { direction: 'a2b', source: 'all' }, now).map((e) => e.id)).toEqual(['1']);
  });

  it('respects size and never repeats an entry', () => {
    const list = Array.from({ length: 30 }, (_, i) => entry(String(i)));
    const quiz = buildQuiz(list, { direction: 'mixed', source: 'all', size: 10 }, now, seeded());
    expect(quiz).toHaveLength(10);
    expect(new Set(quiz.map((q) => q.entryId)).size).toBe(10);
  });

  it('due mode only includes due directions and sorts most overdue first', () => {
    const list = [
      entry('later', { review: { a2b: { box: 3, dueAt: now + DAY, right: 3, wrong: 0 } } }),
      entry('old', { review: { a2b: { box: 1, dueAt: now - 5 * DAY, right: 1, wrong: 0 } } }),
      entry('recent', { review: { a2b: { box: 1, dueAt: now - DAY, right: 1, wrong: 0 } } }),
    ];
    const quiz = buildQuiz(list, { direction: 'a2b', source: 'due', size: 10 }, now, seeded());
    expect(quiz.map((q) => q.entryId)).toEqual(['old', 'recent']);
  });

  it('builds prompts and accepted answers from the right sides', () => {
    const quiz = buildQuiz([entry('x', { b: ['b1', 'b2'] })], { direction: 'a2b', source: 'all', size: 5 }, now, seeded());
    expect(quiz[0].prompt).toBe('a-x');
    expect(quiz[0].accepted).toEqual(['b1', 'b2']);
  });

  it('filters by tag and recency', () => {
    const list = [entry('t', { tags: ['food'] }), entry('n', { createdAt: now - DAY })];
    expect(eligibleEntries(list, { direction: 'a2b', source: 'tag', tag: 'food' }, now).map((e) => e.id)).toEqual(['t']);
    expect(eligibleEntries(list, { direction: 'a2b', source: 'recent' }, now).map((e) => e.id)).toEqual(['n']);
  });
});
