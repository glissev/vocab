import type { User } from 'firebase/auth';
import { isDue } from '../lib/leitner';
import { useOnline } from '../lib/hooks';
import { isComplete, type Entry, type Profile } from '../lib/types';
import { LangTag } from './LangTag';

export type Tab = 'words' | 'quiz' | 'settings';

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  profile: Profile;
  user: User;
  entries: Entry[];
}

export function Header({ tab, onTab, profile, user, entries }: Props) {
  const online = useOnline();
  const now = Date.now();
  const due = entries.filter((e) => isComplete(e) && (isDue(e.review.a2b, now) || isDue(e.review.b2a, now))).length;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'words', label: 'Words' },
    { id: 'quiz', label: 'Quiz', badge: due || undefined },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header className="header">
      <div className="header-row">
        <div className="brand" aria-label={`Vocabulary, ${profile.langA} and ${profile.langB}`}>
          <LangTag code={profile.langA} side="a" />
          <span className="brand-arrows" aria-hidden="true">⇄</span>
          <LangTag code={profile.langB} side="b" />
        </div>
        {!online && <span className="offline-pill">Offline · changes sync later</span>}
        {user.photoURL ? (
          <img className="avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar avatar-fallback" aria-hidden="true">
            {(user.displayName ?? user.email ?? '?').slice(0, 1)}
          </span>
        )}
      </div>
      <nav className="tabs" aria-label="Sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => onTab(t.id)}
          >
            {t.label}
            {t.badge !== undefined && <span className="badge" aria-label={`${t.badge} due`}>{t.badge}</span>}
          </button>
        ))}
      </nav>
    </header>
  );
}
