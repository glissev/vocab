import { useEffect, useRef, useState } from 'react';
import { recordAnswer, updateEntry } from '../data/store';
import { onEnter } from '../lib/hooks';
import { languageName, textDirection } from '../lib/languages';
import type { QuizItem } from '../lib/quiz';
import { checkAnswer, normalize, type AnswerCheck } from '../lib/text';
import type { Entry, Profile } from '../lib/types';

export interface QuizResult {
  item: QuizItem;
  correct: boolean;
  typed: string;
}

interface Props {
  uid: string;
  profile: Profile;
  entries: Entry[];
  items: QuizItem[];
  /** When false (practising missed words) answers do not change the review schedule. */
  record: boolean;
  onFinish: (results: QuizResult[]) => void;
  onQuit: () => void;
}

interface Slot {
  item: QuizItem;
  retry: boolean;
}

export function QuizSession({ uid, profile, entries, items, record, onFinish, onQuit }: Props) {
  const [queue, setQueue] = useState<Slot[]>(() => items.map((item) => ({ item, retry: false })));
  const [pos, setPos] = useState(0);
  const [typed, setTyped] = useState('');
  const [check, setCheck] = useState<AnswerCheck | null>(null);
  const [overridden, setOverridden] = useState(false);
  const [acceptTyped, setAcceptTyped] = useState(true);
  const [inputError, setInputError] = useState<string | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const slot = queue[pos];
  const { item } = slot;
  const promptLang = item.direction === 'a2b' ? profile.langA : profile.langB;
  const answerLang = item.direction === 'a2b' ? profile.langB : profile.langA;
  const promptSide = item.direction === 'a2b' ? 'a' : 'b';
  const answerSide = item.direction === 'a2b' ? 'b' : 'a';

  useEffect(() => {
    inputRef.current?.focus();
  }, [pos]);

  function submit() {
    if (!typed.trim()) {
      setInputError('Type an answer, or choose “Show answer”.');
      return;
    }
    setCheck(checkAnswer(typed, item.accepted, profile.typoTolerance));
  }

  function reveal() {
    setTyped('');
    setInputError(null);
    setCheck({ verdict: 'wrong', expected: item.accepted[0] });
  }

  function next() {
    if (!check) return;
    const correct = overridden || check.verdict !== 'wrong';
    const entry = entries.find((e) => e.id === item.entryId);
    let nextResults = results;
    let nextQueue = queue;

    if (!slot.retry) {
      nextResults = [...results, { item, correct, typed }];
      if (record && entry) recordAnswer(uid, entry, item.direction, correct);
      if (!correct) nextQueue = [...queue, { item, retry: true }];
    }
    if (overridden && acceptTyped && entry && typed.trim()) {
      const side = item.direction === 'a2b' ? 'b' : 'a';
      const current = entry[side];
      if (!current.some((v) => normalize(v) === normalize(typed))) {
        updateEntry(uid, entry.id, { a: entry.a, b: entry.b, note: entry.note, tags: entry.tags, [side]: [...current, typed.trim()] });
      }
    }

    if (pos + 1 >= nextQueue.length) {
      onFinish(nextResults);
      return;
    }
    setResults(nextResults);
    setQueue(nextQueue);
    setPos(pos + 1);
    setTyped('');
    setCheck(null);
    setOverridden(false);
    setAcceptTyped(true);
    setInputError(null);
  }

  const answered = results.length;
  const others = check ? item.accepted.filter((v) => v !== check.expected) : [];

  return (
    <section className="quiz">
      <div className="quiz-top">
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={answered}>
          <div className="progress-fill" style={{ width: `${(answered / items.length) * 100}%` }} />
        </div>
        <span className="muted progress-label">
          {Math.min(answered + (slot.retry ? 0 : 1), items.length)} / {items.length}
          {!record && ' · practice'}
        </span>
        <button className="link-btn" onClick={onQuit}>
          End quiz
        </button>
      </div>

      <div className="card">
        <p className="card-label">
          {languageName(promptLang)} → {languageName(answerLang)}
          {slot.retry && <span className="retry-tag">Second try</span>}
        </p>
        <p className={`prompt headword side-${promptSide}`} lang={promptLang} dir={textDirection(promptLang)}>
          {item.prompt}
        </p>

        <input
          ref={inputRef}
          className={`answer-input side-${answerSide}`}
          lang={answerLang}
          dir={textDirection(answerLang)}
          value={typed}
          readOnly={!!check}
          onChange={(e) => {
            setTyped(e.target.value);
            setInputError(null);
          }}
          onKeyDown={check ? undefined : onEnter(submit)}
          placeholder={`Type in ${languageName(answerLang)}`}
          aria-label={`Answer in ${languageName(answerLang)}`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {inputError && <p className="error">{inputError}</p>}

        {!check ? (
          <div className="actions">
            <button className="btn btn-primary" onClick={submit}>
              Check
            </button>
            <button className="btn btn-quiet" onClick={reveal}>
              Show answer
            </button>
          </div>
        ) : (
          <div className={`feedback verdict-${overridden ? 'correct' : check.verdict}`} aria-live="assertive">
            {(check.verdict === 'correct' || overridden) && <p className="verdict">{overridden ? 'Counted as correct' : 'Correct'}</p>}
            {check.verdict === 'almost' && !overridden && <p className="verdict">Almost — mind the spelling</p>}
            {check.verdict === 'wrong' && !overridden && <p className="verdict">{typed ? 'Not quite' : 'Answer'}</p>}

            {check.verdict !== 'correct' && (
              <p className={`answer headword side-${answerSide}`} lang={answerLang} dir={textDirection(answerLang)}>
                {check.expected}
              </p>
            )}
            {others.length > 0 && (
              <p className="muted" lang={answerLang}>
                Also accepted: {others.join('; ')}
              </p>
            )}

            {check.verdict === 'wrong' && typed && !overridden && (
              <button className="link-btn" onClick={() => setOverridden(true)}>
                I was right
              </button>
            )}
            {overridden && (
              <label className="checkbox">
                <input type="checkbox" checked={acceptTyped} onChange={(e) => setAcceptTyped(e.target.checked)} />
                Also accept “{typed.trim()}” from now on
              </label>
            )}

            <div className="actions">
              <button className="btn btn-primary" autoFocus onClick={next}>
                {pos + 1 >= queue.length && (slot.retry || overridden || check.verdict !== 'wrong') ? 'See results' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
