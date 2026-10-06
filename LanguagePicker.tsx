import { LANGUAGES } from '../lib/languages';

interface Props {
  id: string;
  label: string;
  value: string;
  exclude: string;
  onChange: (code: string) => void;
}

export function LanguagePicker({ id, label, value, exclude, onChange }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} disabled={l.code === exclude}>
            {l.name} · {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
