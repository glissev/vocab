import { useState } from 'react';
import type { Profile, Entry } from '../lib/types';
import { shuffle, type QuizItem } from '../lib/quiz';
import { QuizSetup } from './QuizSetup';
import { QuizSession, type QuizResult } from './QuizSession';
import { QuizSummary } from './QuizSummary';

type Mode =
  | { kind: 'setup' }
  | { kind: 'run'; items: QuizItem[]; record: boolean; key: number }
  | { kind: 'done'; results: QuizResult[]; record: boolean };

interface Props {
  uid: string;
  profile: Profile;
  entries: Entry[];
  onAddWords: () => void;
}

export function QuizView({ uid, profile, entries, onAddWords }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'setup' });

  switch (mode.kind) {
    case 'setup':
      return (
        <QuizSetup
          profile={profile}
          entries={entries}
          onAddWords={onAddWords}
          onStart={(items) => setMode({ kind: 'run', items, record: true, key: Date.now() })}
        />
      );
    case 'run':
      return (
        <QuizSession
          key={mode.key}
          uid={uid}
          profile={profile}
          entries={entries}
          items={mode.items}
          record={mode.record}
          onFinish={(results) => setMode({ kind: 'done', results, record: mode.record })}
          onQuit={() => setMode({ kind: 'setup' })}
        />
      );
    case 'done':
      return (
        <QuizSummary
          profile={profile}
          results={mode.results}
          practice={!mode.record}
          onRetryMissed={(items) => setMode({ kind: 'run', items: shuffle(items), record: false, key: Date.now() })}
          onNewQuiz={() => setMode({ kind: 'setup' })}
        />
      );
  }
}
