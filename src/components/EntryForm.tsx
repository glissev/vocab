import { useEffect, useRef, useState, type ReactNode } from 'react';
import { addEntry, findDuplicates, updateEntry } from '../data/store';
import { onEnter } from '../lib/hooks';
import { exampleWord, languageName, textDirection } from '../lib/languages';
import { joinVariants, splitVariants } from '../lib/text';
import { TranslateError, autoTranslatePlan, isAbort, otherSide, translateWord, type AutoFill, type Side } from '../lib/translate';
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
  const secondField = useRef<HTMLInputElement>(null);

  // Automatic translation: `auto` is the value the app wrote into one side; it counts as a
  // suggestion until the user edits that side, and is replaced when the source word changes.
  const [auto, setAuto] = useState<AutoFill | null>(null);
  const [alts, setAlts] = useState<string[]>([]);
  const [tStatus, setTStatus] = useState<{ side: Side; kind: 'loading' | 'error'; message?: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const pendingRun = useRef<(() => void) | null>(null);

  const texts = { a: aText, b: bText };
  const setters = { a: setAText, b: setBText };
  const langs = { a: profile.langA, b: profile.langB };
  const fields = { a: firstField, b: secondField };

  function cancelTranslation() {
    clearTimeout(timer.current);
    pendingRun.current = null;
    abort.current?.abort();
    abort.current = null;
  }

  function clearAuto() {
    cancelTranslation();
    setAuto(null);
    setAlts([]);
    setTStatus(null);
  }

  useEffect(() => cancelTranslation, []);

  function changeSide(side: Side, value: string) {
    setters[side](value);
    setError(null);
    setDupes([]);
    cancelTranslation();
    setTStatus(null);

    // Typing into the auto-filled side makes it the user's own text.
    const current = auto && auto.side === side ? null : auto;
    if (current !== auto) {
      setAuto(null);
      setAlts([]);
    }
    if (!profile.autoTranslate) return;

    const target = otherSide(side);
    const plan = autoTranslatePlan(side, value, texts[target], current);
    if (plan === 'clear') {
      setters[target]('');
      setAuto(null);
      setAlts([]);
      return;
    }
    if (plan !== 'translate') return;

    const from = langs[side];
    const to = langs[target];
    const run = (focusTarget: boolean) => {
      clearTimeout(timer.current);
      pendingRun.current = null;
      if (!navigator.onLine) return;
      const ctrl = new AbortController();
      abort.current = ctrl;
      setTStatus({ side: target, kind: 'loading' });
      translateWord(value, from, to, ctrl.signal)
        .then(([first, ...rest]) => {
          if (ctrl.signal.aborted) return;
          abort.current = null;
          setTStatus(null);
          if (!first) return;
          setters[target](first);
          setAuto({ side: target, value: first });
          setAlts(rest);
          if (focusTarget) fields[target].current?.focus();
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted || isAbort(err)) return;
          abort.current = null;
          // Don't leave the previous word's translation standing next to a new word.
          if (current) {
            setters[target]((t) => (t === current.value ? '' : t));
            setAuto(null);
            setAlts([]);
          }
          const message = err instanceof TranslateError ? err.message : 'Couldn’t translate this word. Type the translation yourself.';
          setTStatus({ side: target, kind: 'error', message });
        });
    };
    pendingRun.current = () => run(true);
    timer.current = setTimeout(() => run(false), 600);
  }

  function addAlternative(word: string) {
    if (!auto) return;
    const value = joinVariants([...splitVariants(texts[auto.side]), word]);
    setters[auto.side](value);
    setAuto({ side: auto.side, value });
    setAlts((list) => list.filter((w) => w !== word));
  }

  function translateNote(side: Side) {
    let content: ReactNode = null;
    if (tStatus?.side === side) {
      content = tStatus.kind === 'loading' ? 'Translating…' : <span className="translate-error">{tStatus.message}</span>;
    } else if (auto?.side === side && texts[side] === auto.value) {
      content = (
        <>
          Automatic translation. Check it before saving.
          {alts.length > 0 && (
            <span className="translate-alts">
              {' '}Also:
              {alts.map((w) => (
                <button key={w} className="link-btn" lang={langs[side]} onClick={() => addAlternative(w)} title="Add as another translation">
                  + {w}
                </button>
              ))}
            </span>
          )}
        </>
      );
    }
    return (
      <div className="translate-note" aria-live="polite">
        {content}
      </div>
    );
  }

  function isAuto(side: Side) {
    return auto?.side === side && texts[side] === auto.value;
  }

  useEffect(() => {
    clearAuto();
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
    clearAuto();
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

  // Enter while a translation is still waiting fetches it right away and moves to that side;
  // a second Enter saves. Enter during a running request is ignored.
  const submit = onEnter(() => {
    if (pendingRun.current) return pendingRun.current();
    if (abort.current) return;
    save();
  });

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
            className={isAuto('a') ? 'word-input is-auto' : 'word-input'}
            lang={profile.langA}
            dir={textDirection(profile.langA)}
            value={aText}
            onChange={(e) => changeSide('a', e.target.value)}
            onKeyDown={submit}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={exampleWord(profile.langA)}
          />
          {translateNote('a')}
        </div>
        <div className="field side-b">
          <label htmlFor="ef-b">
            <LangTag code={profile.langB} side="b" /> {languageName(profile.langB)}
          </label>
          <input
            id="ef-b"
            ref={secondField}
            className={isAuto('b') ? 'word-input is-auto' : 'word-input'}
            lang={profile.langB}
            dir={textDirection(profile.langB)}
            value={bText}
            onChange={(e) => changeSide('b', e.target.value)}
            onKeyDown={submit}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={exampleWord(profile.langB)}
          />
          {translateNote('b')}
        </div>
      </div>
      <p className="hint">
        {profile.autoTranslate
          ? 'Type a word on either side and the other side fills in automatically. Separate alternative translations with “;”.'
          : 'Fill in one side or both. Separate alternative translations with “;”.'}
      </p>

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
