import { useMemo, useState } from 'react';
import { deleteEntry } from '../data/store';
import { MAX_BOX } from '../lib/leitner';
import { textDirection } from '../lib/languages';
import { joinVariants, matchesSearch } from '../lib/text';
import { isComplete, type Entry, type Profile } from '../lib/types';

interface Props {
  uid: string;
  profile: Profile;
  entries: Entry[];
  onEdit: (e: Entry) => void;
}

const PAGE = 150;

export function WordList({ uid, profile, entries, onEdit }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);

  const tags = useMemo(() => Array.from(new Set(entries.flatMap((e) => e.tags))).sort(), [entries]);
  const incomplete = entries.filter((e) => !isComplete(e)).length;

  const visible = useMemo(
    () =>
      entries.filter((e) => {
        if (filter === 'incomplete' && isComplete(e)) return false;
        if (filter.startsWith('tag:') && !e.tags.includes(filter.slice(4))) return false;
        return matchesSearch([...e.a, ...e.b, e.note], query);
      }),
    [entries, filter, query],
  );

  if (entries.length === 0) {
    return (
      <section className="empty">
        <p>Your list is empty. Add your first word above, or import a spreadsheet in Settings.</p>
      </section>
    );
  }

  return (
    <section aria-label="Your words">
      <div className="list-tools">
        <input
          type="search"
          className="search"
          placeholder="Search both languages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search words"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter words">
          <option value="all">All words</option>
          {incomplete > 0 && <option value="incomplete">Needs translation ({incomplete})</option>}
          {tags.map((t) => (
            <option key={t} value={`tag:${t}`}>
              #{t}
            </option>
          ))}
        </select>
      </div>
      <p className="count muted">
        {visible.length === entries.length ? `${entries.length} words` : `${visible.length} of ${entries.length} words`}
      </p>

      <ul className="word-list">
        {visible.slice(0, limit).map((e) => (
          <WordRow key={e.id} entry={e} profile={profile} onEdit={() => onEdit(e)} onDelete={() => deleteEntry(uid, e.id)} />
        ))}
      </ul>
      {visible.length > limit && (
        <button className="btn btn-quiet wide" onClick={() => setLimit(limit + PAGE)}>
          Show more ({visible.length - limit} left)
        </button>
      )}
    </section>
  );
}

function WordRow({ entry, profile, onEdit, onDelete }: { entry: Entry; profile: Profile; onEdit: () => void; onDelete: () => void }) {
  const level = Math.min(entry.review.a2b?.box ?? 0, entry.review.b2a?.box ?? 0);
  return (
    <li className="word-row">
      <div className="word-pair">
        <Side words={entry.a} lang={profile.langA} side="a" onEdit={onEdit} />
        <Side words={entry.b} lang={profile.langB} side="b" onEdit={onEdit} />
      </div>
      {(entry.note || entry.tags.length > 0) && (
        <p className="word-meta">
          {entry.note}
          {entry.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </p>
      )}
      <div className="word-actions">
        <span className="meter" title={`Learned both ways: level ${level} of ${MAX_BOX}`} aria-label={`Level ${level} of ${MAX_BOX}`}>
          {Array.from({ length: MAX_BOX }, (_, i) => (
            <i key={i} className={i < level ? 'on' : ''} />
          ))}
        </span>
        <button className="link-btn" onClick={onEdit}>
          Edit
        </button>
        <button
          className="link-btn danger"
          onClick={() => {
            if (confirm(`Delete “${joinVariants(entry.a) || joinVariants(entry.b)}”?`)) onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function Side({ words, lang, side, onEdit }: { words: string[]; lang: string; side: 'a' | 'b'; onEdit: () => void }) {
  if (words.length === 0) {
    return (
      <button className={`word-side missing side-${side}`} onClick={onEdit}>
        add translation
      </button>
    );
  }
  return (
    <span className={`word-side side-${side}`} lang={lang} dir={textDirection(lang)}>
      {joinVariants(words)}
    </span>
  );
}
