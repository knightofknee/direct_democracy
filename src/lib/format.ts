import type { Timestamp } from 'firebase/firestore';

import { countNoun, tr } from '@/lib/i18n';

/** "5m ago", "3d ago", in the app's language (keyed templates in each dictionary). */
export function timeAgo(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const ago = (template: string, n: number) => tr(template).replace('{n}', String(n));
  const seconds = Math.max(0, Math.floor((Date.now() - ts.toMillis()) / 1000));
  if (seconds < 60) return tr('just now');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return ago('{n}m ago', minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return ago('{n}h ago', hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return ago('{n}d ago', days);
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? tr('1mo ago') : ago('{n}mo ago', months);
  const years = Math.floor(months / 12);
  return years === 1 ? tr('1y ago') : ago('{n}y ago', years);
}

export function pct(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n.toLocaleString()} ${countNoun(n, singular, pluralForm)}`;
}

/** "https://www.example.org/page" -> "example.org", for compact link labels. */
export function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
