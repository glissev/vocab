import { languageName } from '../lib/languages';
import type { QuizItem } from '../lib/quiz';
import type { Profile } from '../lib/types';
import type { QuizResult } from './QuizSession';

interface Props {
  profile: Profile;
  results: QuizResult[];
  practice: boolean;
  onRetryMissed: (items: QuizItem[]) => void;
  onNewQuiz: () => void;
}

export function QuizSummary({ profile, results, practice, onRetryMissed, onNewQuiz }: Props) {
  const right = results.filter((r) => r.correct).length;
  const missed = results.filter((r) => !r.correct);
  const lang = (r: QuizResult, side: 'prompt' | 'answer') =>
    (r.item.direction === 'a2b') === (side === 'prompt') ? profile.langA : profile.langB;

  return (
    <section className="panel summary">
      <p className="score">
        <span className="score-num">{right}</span>
        <span className="score-of">/ {results.length}</span>
      </p>
      <p className="muted">
        {results.length === 0
          ? 'No answers recorded.'
          : practice
            ? 'right in this practice round'
            : missed.length === 0
              ? 'All right first time. These words move up a level.'
              : 'right first time. Missed words come back sooner.'}
      </p>

      {missed.length > 0 && (
        <>
          <h3>To review</h3>
          <ul className="missed">
            {missed.map((r, i) => (
              <li key={i}>
                <span lang={lang(r, 'prompt')} className={`word-side side-${r.item.direction === 'a2b' ? 'a' : 'b'}`}>
                  {r.item.prompt}
                </span>
                <span className="muted" aria-label={`${languageName(lang(r, 'prompt'))} to ${languageName(lang(r, 'answer'))}`}>
                  →
                </span>
                <span lang={lang(r, 'answer')} className={`word-side missed-answer side-${r.item.direction === 'a2b' ? 'b' : 'a'}`}>
                  {r.item.accepted.join('; ')}
                </span>
                {r.typed && <span className="missed-typed">you typed “{r.typed}”</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="actions">
        {missed.length > 0 && (
          <button className="btn btn-primary" onClick={() => onRetryMissed(missed.map((r) => r.item))}>
            Practise missed words
          </button>
        )}
        <button className={`btn ${missed.length > 0 ? 'btn-quiet' : 'btn-primary'}`} onClick={onNewQuiz}>
          New quiz
        </button>
      </div>
    </section>
  );
}
