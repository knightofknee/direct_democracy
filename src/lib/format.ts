import type { Timestamp } from 'firebase/firestore';

import { getLocale, tr } from '@/lib/i18n';

export function timeAgo(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const es = getLocale() === 'es';
  const seconds = Math.max(0, Math.floor((Date.now() - ts.toMillis()) / 1000));
  if (seconds < 60) return es ? 'ahora mismo' : 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return es ? `hace ${minutes} min` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return es ? `hace ${hours} h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return es ? `hace ${days} d` : `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return es ? (months === 1 ? 'hace 1 mes' : `hace ${months} meses`) : `${months}mo ago`;
  const years = Math.floor(months / 12);
  return es ? (years === 1 ? 'hace 1 año' : `hace ${years} años`) : `${years}y ago`;
}

export function pct(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n.toLocaleString()} ${tr(n === 1 ? singular : (pluralForm ?? `${singular}s`))}`;
}

/** "https://www.example.org/page" -> "example.org", for compact link labels. */
export function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
