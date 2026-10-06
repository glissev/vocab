import { useEffect, useState, type KeyboardEvent } from 'react';

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Enter-key handler that ignores the Enter used to confirm IME composition
 * (Korean, Japanese, Chinese input), which would otherwise submit half-typed text.
 */
export function onEnter(handler: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    handler();
  };
}

export function formatRelative(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60 * 60 * 1000) return rtf.format(Math.round(diff / 60000), 'minute');
  if (abs < 24 * 60 * 60 * 1000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  return rtf.format(Math.round(diff / 86_400_000), 'day');
}
