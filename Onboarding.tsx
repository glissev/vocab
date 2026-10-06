import { useState } from 'react';
import { saveProfile } from '../data/store';
import { DEFAULT_PROFILE } from '../lib/types';
import { LanguagePicker } from './LanguagePicker';

export function Onboarding({ uid }: { uid: string }) {
  const [langA, setLangA] = useState(DEFAULT_PROFILE.langA);
  const [langB, setLangB] = useState(DEFAULT_PROFILE.langB);

  return (
    <main className="center-screen">
      <div className="panel narrow">
        <h1>Choose your two languages</h1>
        <p className="muted">Every word you save has one side in each. You can change the names later in Settings.</p>
        <div className="stack">
          <LanguagePicker id="ob-a" label="First language" value={langA} exclude={langB} onChange={setLangA} />
          <LanguagePicker id="ob-b" label="Second language" value={langB} exclude={langA} onChange={setLangB} />
        </div>
        <button className="btn btn-primary" onClick={() => saveProfile(uid, { ...DEFAULT_PROFILE, langA, langB, createdAt: Date.now() })}>
          Start my word list
        </button>
      </div>
    </main>
  );
}
