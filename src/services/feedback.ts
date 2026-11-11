import * as Application from 'expo-application';
import { doc, updateDoc, type Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';

import { db, functions } from '@/lib/firebase';
import { getLocale } from '@/lib/i18n';

/**
 * Settings > Send feedback (2026-10-22): a message to the operators from
 * inside the app, signed in or not, through the sendFeedback callable
 * (functions/src/index.ts). Child safety messages alert the operator at once.
 */
export type FeedbackTopic = 'childSafety' | 'safety' | 'bug' | 'idea' | 'other';

export const FEEDBACK_TOPICS: { key: FeedbackTopic; label: string }[] = [
  // First and named on its own, like the report reason: a child safety
  // concern must be unmistakable to raise.
  { key: 'childSafety', label: 'A child’s safety' },
  { key: 'safety', label: 'A post or a person in the app' },
  { key: 'bug', label: 'Something isn’t working' },
  { key: 'idea', label: 'An idea for the app' },
  { key: 'other', label: 'Something else' },
];

export interface Feedback {
  id: string;
  topic: FeedbackTopic;
  message: string;
  uid: string | null;
  email: string | null;
  platform: string | null;
  appVersion: string | null;
  locale: string | null;
  status: 'open' | 'handled';
  createdAt: Timestamp;
}

export async function sendFeedback(input: { topic: FeedbackTopic; message: string; email?: string }): Promise<void> {
  const call = httpsCallable(functions, 'sendFeedback');
  await call({
    topic: input.topic,
    message: input.message.trim(),
    email: input.email?.trim() || undefined,
    platform: Platform.OS,
    appVersion: Platform.OS === 'web' ? 'web' : (Application.nativeApplicationVersion ?? 'unknown'),
    locale: getLocale(),
  });
}

/** Operator only (rules): mark a message dealt with. */
export async function markFeedbackHandled(id: string): Promise<void> {
  await updateDoc(doc(db, 'feedback', id), { status: 'handled' });
}
