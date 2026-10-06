export function LangTag({ code, side }: { code: string; side: 'a' | 'b' }) {
  return <span className={`lang-tag side-${side}`}>{code.toUpperCase()}</span>;
}
