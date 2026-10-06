import { useState } from 'react';
import type { EntriesState } from '../data/store';
import type { Entry, Profile } from '../lib/types';
import { EntryForm } from './EntryForm';
import { WordList } from './WordList';

export function WordsView({ uid, profile, state }: { uid: string; profile: Profile; state: EntriesState }) {
  const [editing, setEditing] = useState<Entry | null>(null);

  return (
    <>
      <EntryForm uid={uid} profile={profile} entries={state.entries} editing={editing} onDone={() => setEditing(null)} />
      {state.error && (
        <p className="error" role="alert">
          Could not load your words: {state.error}
        </p>
      )}
      {state.loading ? (
        <p className="muted">Loading your words…</p>
      ) : (
        <WordList
          uid={uid}
          profile={profile}
          entries={state.entries}
          onEdit={(e) => {
            setEditing(e);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </>
  );
}
