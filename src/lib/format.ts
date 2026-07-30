import type { Timestamp } from 'firebase/firestore';

export function timeAgo(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - ts.toMillis()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function pct(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
