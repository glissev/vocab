import { useState } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from '../data/auth';
import { importEntries, isSamePair, saveProfile } from '../data/store';
import { entriesToCsv, looksLikeHeader, parseImport, type ParsedImport } from '../lib/csv';
import { languageName } from '../lib/languages';
import { normalize } from '../lib/text';
import type { Entry, EntryDraft, Profile } from '../lib/types';
import { LanguagePicker } from './LanguagePicker';

interface Props {
  uid: string;
  profile: Profile;
  entries: Entry[];
  user: User;
}

export function SettingsView({ uid, profile, entries, user }: Props) {
  const { signOutUser } = useAuth();

  return (
    <div className="settings">
      <section className="panel">
        <h2>Languages</h2>
        <p className="muted">Changing a language renames that side of every word. Your words themselves stay as they are.</p>
        <div className="pair">
          <LanguagePicker id="st-a" label="First language" value={profile.langA} exclude={profile.langB} onChange={(langA) => saveProfile(uid, { langA })} />
          <LanguagePicker id="st-b" label="Second language" value={profile.langB} exclude={profile.langA} onChange={(langB) => saveProfile(uid, { langB })} />
        </div>
      </section>

      <section className="panel">
        <h2>Adding words</h2>
        <label className="checkbox">
          <input type="checkbox" checked={profile.autoTranslate} onChange={(e) => saveProfile(uid, { autoTranslate: e.target.checked })} />
          Translate new words automatically
        </label>
        <p className="hint">
          When you type a word on one side, the other side fills in with a suggestion you can edit. Uses the free MyMemory
          service, which receives the word you type and allows about 5,000 characters a day.
        </p>
      </section>

      <section className="panel">
        <h2>Quiz</h2>
        <div className="field">
          <label htmlFor="st-size">Default number of words</label>
          <select id="st-size" value={profile.quizSize} onChange={(e) => saveProfile(uid, { quizSize: Number(e.target.value) })}>
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={profile.typoTolerance} onChange={(e) => saveProfile(uid, { typoTolerance: e.target.checked })} />
          Accept answers with one typo (words of four letters or more)
        </label>
      </section>

      <ImportExport uid={uid} profile={profile} entries={entries} />

      <section className="panel">
        <h2>Account</h2>
        <p>
          Signed in as <strong>{user.email}</strong>
        </p>
        <button className="btn btn-quiet" onClick={signOutUser}>
          Sign out
        </button>
      </section>
    </div>
  );
}

function ImportExport({ uid, profile, entries }: { uid: string; profile: Profile; entries: Entry[] }) {
  const [text, setText] = useState('');
  const [hasHeader, setHasHeader] = useState(false);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load(raw: string) {
    const header = looksLikeHeader(raw, profile.langA, profile.langB);
    setText(raw);
    setHasHeader(header);
    setParsed(raw.trim() ? parseImport(raw, header) : null);
    setMessage(null);
  }

  function exportCsv() {
    const csv = entriesToCsv(entries, profile.langA, profile.langB);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocab-${profile.langA}-${profile.langB}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function runImport() {
    if (!parsed) return;
    const fresh: EntryDraft[] = [];
    let duplicates = 0;
    for (const row of parsed.rows) {
      const known = entries.some((e) => isSamePair(e, row));
      const inBatch = fresh.some((f) => isSamePair({ aNorm: f.a.map(normalize), bNorm: f.b.map(normalize) }, row));
      if (known || inBatch) duplicates++;
      else fresh.push(row);
    }
    importEntries(uid, fresh);
    setMessage(`Imported ${fresh.length} words${duplicates ? `, skipped ${duplicates} already in your list` : ''}.`);
    setText('');
    setParsed(null);
  }

  return (
    <section className="panel">
      <h2>Import and export</h2>
      <p className="muted">
        Spreadsheet layout: {languageName(profile.langA)} in column 1, {languageName(profile.langB)} in column 2, then an
        optional note and tags. Separate alternative translations with “;”.
      </p>

      <div className="actions">
        <button className="btn btn-quiet" onClick={exportCsv} disabled={entries.length === 0}>
          Export {entries.length} words as CSV
        </button>
      </div>

      <div className="field">
        <label htmlFor="imp-file">Import a CSV file</label>
        <input
          id="imp-file"
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) load(await file.text());
            e.target.value = '';
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="imp-paste">…or paste rows copied from Excel or Google Sheets</label>
        <textarea id="imp-paste" rows={4} value={text} onChange={(e) => load(e.target.value)} />
      </div>

      {parsed && (
        <div className="import-preview">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => {
                setHasHeader(e.target.checked);
                setParsed(parseImport(text, e.target.checked));
              }}
            />
            First row is a header
          </label>
          <table>
            <thead>
              <tr>
                <th>{languageName(profile.langA)}</th>
                <th>{languageName(profile.langB)}</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {parsed.rows.slice(0, 5).map((r, i) => (
                <tr key={i}>
                  <td lang={profile.langA}>{r.a.join('; ')}</td>
                  <td lang={profile.langB}>{r.b.join('; ')}</td>
                  <td>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parsed.rows.length > 5 && <p className="muted">…and {parsed.rows.length - 5} more rows</p>}
          <button className="btn btn-primary" onClick={runImport} disabled={parsed.rows.length === 0}>
            Import {parsed.rows.length} words
          </button>
        </div>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
