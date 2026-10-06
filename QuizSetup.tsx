import { useMemo, useState } from 'react';
import { isDue } from '../lib/leitner';
import { formatRelative } from '../lib/hooks';
import { buildQuiz, eligibleEntries, type DirectionMode, type QuizItem, type QuizSource } from '../lib/quiz';
import { languageName } from '../lib/languages';
import { isComplete, type Entry, type Profile } from '../lib/types';

interface Props {
  profile: Profile;
  entries: Entry[];
  onStart: (items: QuizItem[]) => void;
  onAddWords: () => void;
}

const SIZES = [10, 20, 50];

export function QuizSetup({ profile, entries, onStart, onAddWords }: Props) {
  const A = profile.langA.toUpperCase();
  const B = profile.langB.toUpperCase();
  const [direction, setDirection] = useState<DirectionMode>('mixed');
  const [source, setSource] = useState<QuizSource>('due');
  const tags = useMemo(() => Array.from(new Set(entries.flatMap((e) => e.tags))).sort(), [entries]);
  const [tag, setTag] = useState<string>('');
  const [size, setSize] = useState(SIZES.includes(profile.quizSize) ? profile.quizSize : 20);

  const complete = entries.filter(isComplete);
  const now = Date.now();
  const count = (s: QuizSource) => eligibleEntries(entries, { direction, source: s, tag: tag || tags[0] }, now).length;
  const available = count(source);

  if (complete.length === 0) {
    return (
      <section className="panel narrow-center">
        <h2>No words to practise yet</h2>
        <p className="muted">
          A quiz needs words with both a {languageName(profile.langA)} and a {languageName(profile.langB)} side.
        </p>
        <button className="btn btn-primary" onClick={onAddWords}>
          Add words
        </button>
      </section>
    );
  }

  const dirs = direction === 'mixed' ? (['a2b', 'b2a'] as const) : ([direction] as const);
  const nextDue = Math.min(
    ...complete.flatMap((e) => dirs.map((d) => e.review[d]).filter((r) => r && !isDue(r, now)).map((r) => r!.dueAt)),
  );

  const sources: { id: QuizSource; label: string; disabled?: boolean }[] = [
    { id: 'due', label: 'Due for review' },
    { id: 'all', label: 'All words' },
    { id: 'recent', label: 'Added this week' },
    { id: 'tag', label: 'By tag', disabled: tags.length === 0 },
  ];

  function start() {
    const items = buildQuiz(entries, { direction, source, tag: tag || tags[0], size });
    if (items.length > 0) onStart(items);
  }

  return (
    <section className="panel quiz-setup">
      <h2>Quiz</h2>

      <fieldset>
        <legend>Direction</legend>
        <div className="segmented">
          {(
            [
              ['a2b', `${A} → ${B}`],
              ['b2a', `${B} → ${A}`],
              ['mixed', 'Both ways'],
            ] as const
          ).map(([id, label]) => (
            <label key={id} className={direction === id ? 'on' : ''}>
              <input type="radio" name="direction" value={id} checked={direction === id} onChange={() => setDirection(id)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Words</legend>
        <div className="choice-list">
          {sources.map((s) => (
            <label key={s.id} className={`choice ${source === s.id ? 'on' : ''} ${s.disabled ? 'disabled' : ''}`}>
              <input type="radio" name="source" value={s.id} checked={source === s.id} disabled={s.disabled} onChange={() => setSource(s.id)} />
              <span>{s.label}</span>
              {!s.disabled && <span className="choice-count">{count(s.id)}</span>}
            </label>
          ))}
        </div>
        {source === 'tag' && tags.length > 0 && (
          <select value={tag || tags[0]} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
            {tags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      <fieldset>
        <legend>Length</legend>
        <div className="segmented">
          {SIZES.map((n) => (
            <label key={n} className={size === n ? 'on' : ''}>
              <input type="radio" name="size" value={n} checked={size === n} onChange={() => setSize(n)} />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      {available === 0 ? (
        <div className="notice">
          {source === 'due' ? (
            <p>
              Nothing is due{Number.isFinite(nextDue) ? `. The next review is ${formatRelative(nextDue, now)}` : ''}. Pick
              “All words” to practise anyway.
            </p>
          ) : (
            <p>No words match this choice.</p>
          )}
        </div>
      ) : (
        <button className="btn btn-primary btn-large" onClick={start}>
          Start quiz · {Math.min(size, available)} words
        </button>
      )}
    </section>
  );
}
