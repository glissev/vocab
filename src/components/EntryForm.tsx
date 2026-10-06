import { useEffect, useRef, useState } from 'react';
import { addEntry, findDuplicates, updateEntry } from '../data/store';
import { onEnter } from '../lib/hooks';
import { exampleWord, languageName, textDirection } from '../lib/languages';
import { joinVariants, splitVariants } from '../lib/text';
import type { Entry, EntryDraft, Profile } from '../lib/types';
import { LangTag } from './LangTag';

interface Props {
  uid: string;
  profile: Profile;
  entries: Entry[];
  editing: Entry | null;
  onDone: () => void;
}

function parseTags(text: string): string[] {
  return Array.from(new Set(text.split(/[\s,;|]+/).map((t) => t.trim().toLowerCase()).filter(Boolean)));
}

function mergeUnique(a: string[], b: string[]): string[] {
  const out = a.slice();
  for (const v of b) if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  return out;
}

export function EntryForm({ uid, profile, entries, editing, onDone }: Props) {
  const [aText, setAText] = useState('');
  const [bText, setBText] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupes, setDupes] = useState<Entry[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAText(editing ? joinVariants(editing.a) : '');
    setBText(editing ? joinVariants(editing.b) : '');
    setNote(editing?.note ?? '');
    setTags(editing?.tags.join(' ') ?? '');
    setShowMore(!!editing && (!!editing.note || editing.tags.length > 0));
    setError(null);
    setDupes([]);
    if (editing) firstField.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  function draft(): EntryDraft {
    return { a: splitVariants(aText), b: splitVariants(bText), note, tags: parseTags(tags) };
  }

  function reset(message: string) {
    setAText('');
    setBText('');
    setNote('');
    setTags('');
    setDupes([]);
    setError(null);
    setSaved(message);
    onDone();
    firstField.current?.focus();
  }

  function save(force = false) {
    const d = draft();
    if (d.a.length === 0 && d.b.length === 0) {
      setError(`Enter a word in ${languageName(profile.langA)} or ${languageName(profile.langB)}.`);
      return;
    }
    if (editing) {
      updateEntry(uid, editing.id, d);
      reset('Changes saved');
      return;
    }
    const found = findDuplicates(entries, d);
    if (found.length > 0 && !force) {
      setDupes(found.slice(0, 3));
      return;
    }
    addEntry(uid, d);
    reset('Word saved');
  }

  function mergeInto(target: Entry) {
    const d = draft();
    updateEntry(uid, target.id, {
      a: mergeUnique(target.a, d.a),
      b: mergeUnique(target.b, d.b),
      note: target.note || d.note,
      tags: mergeUnique(target.tags, d.tags),
    });
    reset('Merged into existing word');
  }

  const submit = onEnter(() => save());

  return (
    <section className="panel entry-form" aria-label={editing ? 'Edit word' : 'Add a word'}>
      <div className="pair">
        <div className="field side-a">
          <label htmlFor="ef-a">
            <LangTag code={profile.langA} side="a" /> {languageName(profile.langA)}
          </label>
          <input
            id="ef-a"
            ref={firstField}
            className="word-input"
            lang={profile.langA}
            dir={textDirection(profile.langA)}
            value={aText}
            onChange={(e) => {
              setAText(e.target.value);
              setError(null);
              setDupes([]);
            }}
            onKeyDown={submit}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={exampleWord(profile.langA)}
          />
        </div>
        <div className="field side-b">
          <label htmlFor="ef-b">
            <LangTag code={profile.langB} side="b" /> {languageName(profile.langB)}
          </label>
          <input
            id="ef-b"
            className="word-input"
            lang={profile.langB}
            dir={textDirection(profile.langB)}
            value={bText}
            onChange={(e) => {
              setBText(e.target.value);
              setError(null);
              setDupes([]);
            }}
            onKeyDown={submit}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={exampleWord(profile.langB)}
          />
        </div>
      </div>
      <p className="hint">Fill in one side or both. Separate alternative translations with “;”.</p>

      {showMore ? (
        <div className="pair">
          <div className="field">
            <label htmlFor="ef-note">Note</label>
            <input id="ef-note" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={submit} placeholder="Example sentence, gender, context" />
          </div>
          <div className="field">
            <label htmlFor="ef-tags">Tags</label>
            <input id="ef-tags" value={tags} onChange={(e) => setTags(e.target.value)} onKeyDown={submit} placeholder="food lesson3" />
          </div>
        </div>
      ) : (
        <button className="link-btn" onClick={() => setShowMore(true)}>
          Add a note or tags
        </button>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {dupes.length > 0 && (
        <div className="dupes" role="alert">
          <p>
            <strong>Already in your list:</strong>
          </p>
          <ul>
            {dupes.map((d) => (
              <li key={d.id}>
                <span lang={profile.langA}>{joinVariants(d.a) || '—'}</span>
                <span className="dupes-sep">·</span>
                <span lang={profile.langB}>{joinVariants(d.b) || '—'}</span>
                <button className="link-btn" onClick={() => mergeInto(d)}>
                  Merge into this word
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-quiet" onClick={() => save(true)}>
            Save as a separate word
          </button>
        </div>
      )}

      <div className="actions">
        <button className="btn btn-primary" onClick={() => save()}>
          {editing ? 'Save changes' : 'Save word'}
        </button>
        {editing && (
          <button className="btn btn-quiet" onClick={onDone}>
            Cancel
          </button>
        )}
        <span className="saved" aria-live="polite">
          {saved}
        </span>
      </div>
    </section>
  );
}
