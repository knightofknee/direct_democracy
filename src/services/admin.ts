import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { ReportReason } from '@/services/moderation';

/**
 * Operator-side moderation. Every call here is rules-gated to the admin
 * email - a non-admin calling these gets permission-denied, nothing more.
 * Takedowns delete the reported document; the existing deletion triggers
 * rebalance counts, scores, and official report cards.
 */

export interface Report {
  id: string;
  reporterUid: string;
  contentPath: string;
  contentType: 'concern' | 'comment' | 'question' | 'response';
  reason: ReportReason;
  excerpt: string;
  authorUid: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: Timestamp;
}

/** Where to send the admin to see the reported content in context. */
export function reportContentRoute(report: Report): string | null {
  const parts = report.contentPath.split('/');
  if (parts[0] === 'concerns' && parts.length >= 2) return `/concern/${parts[1]}`;
  if (parts[0] === 'officials' && parts.length >= 2) return `/official/${parts[1]}`;
  return null;
}

/** Take the reported content down and close the report. */
export async function removeReportedContent(report: Report): Promise<void> {
  await deleteDoc(doc(db, report.contentPath));
  await updateDoc(doc(db, 'reports', report.id), { status: 'resolved' });
}

/** Close the report leaving the content up. */
export async function dismissReport(report: Report): Promise<void> {
  await updateDoc(doc(db, 'reports', report.id), { status: 'dismissed' });
}
