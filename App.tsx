import { useState } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from './data/auth';
import { useEntries, useProfile } from './data/store';
import { missingConfig } from './firebase';
import { Header, type Tab } from './components/Header';
import { SignIn } from './components/SignIn';
import { Onboarding } from './components/Onboarding';
import { WordsView } from './components/WordsView';
import { QuizView } from './components/QuizView';
import { SettingsView } from './components/SettingsView';

export function App() {
  const { user, loading } = useAuth();

  if (missingConfig.length > 0) {
    return (
      <main className="center-screen">
        <div className="panel narrow">
          <h1>Firebase is not configured</h1>
          <p>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill in {missingConfig.join(', ')}. See README.
          </p>
        </div>
      </main>
    );
  }
  if (loading) return <Splash />;
  if (!user) return <SignIn />;
  return <SignedIn user={user} />;
}

function Splash() {
  return (
    <main className="center-screen" aria-busy="true">
      <p className="muted">Loading…</p>
    </main>
  );
}

function SignedIn({ user }: { user: User }) {
  const profileState = useProfile(user.uid);
  const entriesState = useEntries(user.uid);
  const [tab, setTab] = useState<Tab>('words');

  if (profileState.status === 'loading') return <Splash />;
  if (profileState.status === 'missing') return <Onboarding uid={user.uid} />;

  const { profile } = profileState;
  return (
    <div className="app">
      <Header tab={tab} onTab={setTab} profile={profile} user={user} entries={entriesState.entries} />
      <main className="content">
        {tab === 'words' && <WordsView uid={user.uid} profile={profile} state={entriesState} />}
        {tab === 'quiz' && <QuizView uid={user.uid} profile={profile} entries={entriesState.entries} onAddWords={() => setTab('words')} />}
        {tab === 'settings' && <SettingsView uid={user.uid} profile={profile} entries={entriesState.entries} user={user} />}
      </main>
    </div>
  );
}
