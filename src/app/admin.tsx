import { useRouter } from 'expo-router';
import { collection, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { SkeletonCards } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, EmptyState, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { isAdminUser } from '@/lib/admin';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { timeAgo } from '@/lib/format';
import { notifyError } from '@/lib/notify';
import {
  dismissReport,
  removeReportedContent,
  reportContentRoute,
  type Report,
} from '@/services/admin';
import { FEEDBACK_TOPICS, markFeedbackHandled, type Feedback } from '@/services/feedback';
import { REPORT_REASONS } from '@/services/moderation';

/**
 * The operator's report queue. Access is enforced by security rules (admin
 * email); this screen just renders what those rules allow.
 */
export default function AdminScreen() {
  const { user, loading } = useAuth();
  const isAdmin = isAdminUser(user);

  const { data: reports, loading: reportsLoading } = useLiveQuery<Report>(
    () =>
      isAdmin
        ? query(collection(db, 'reports'), where('status', '==', 'open'), orderBy('createdAt', 'desc'))
        : null,
    [isAdmin]
  );
  // Few enough to sort here, which spares the query a composite index.
  const { data: openFeedback } = useLiveQuery<Feedback>(
    () => (isAdmin ? query(collection(db, 'feedback'), where('status', '==', 'open')) : null),
    [isAdmin]
  );
  const feedback = [...openFeedback].sort(
    (a, b) =>
      Number(b.topic === 'childSafety') - Number(a.topic === 'childSafety') ||
      (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
  );

  if (loading) return <Screen>{null}</Screen>;
  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" message="Operators only." />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={`Open reports (${reports.length})`}
        subtitle="Removing content deletes it and lets the triggers rebalance every count"
      />
      {reportsLoading ? (
        <SkeletonCards count={2} />
      ) : reports.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" message="No open reports. All clear." />
      ) : (
        reports.map((r) => <ReportCard key={r.id} report={r} />)
      )}
      <SectionHeader title={`Feedback (${feedback.length})`} subtitle="Sent from Settings, signed in or not" />
      {feedback.length === 0 ? (
        <EmptyState icon="mail-open-outline" message="No open feedback." />
      ) : (
        feedback.map((f) => <FeedbackCard key={f.id} item={f} />)
      )}
    </Screen>
  );
}

function ReportCard({ report }: { report: Report }) {
  const theme = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const route = reportContentRoute(report);
  const reasons = report.reasons?.length ? report.reasons : [report.reason];

  const act = async (fn: () => Promise<void>, label: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notifyError(label, e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip label={report.contentType} tone="primary" />
        {reasons.map((r) => (
          <Chip
            key={r}
            label={REPORT_REASONS.find((x) => x.key === r)?.label ?? r}
            tone={r === 'childSafety' ? 'danger' : 'warning'}
          />
        ))}
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {timeAgo(report.createdAt)}
        </ThemedText>
      </View>
      {report.note ? (
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          Reporter says: “{report.note}”
        </ThemedText>
      ) : reasons.includes('other') ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          Reporter gave no reason.
        </ThemedText>
      ) : null}
      <ThemedText type="small" style={{ fontStyle: 'italic' }}>
        “{report.excerpt}”
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
        {report.contentPath}
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
        {route && (
          <Button title="View in context" variant="secondary" onPress={() => router.push(route as never)} />
        )}
        {confirmRemove ? (
          <>
            <Button
              title="Confirm takedown"
              variant="danger"
              disabled={busy}
              onPress={() => act(() => removeReportedContent(report), 'Takedown failed')}
            />
            <Button title="Back" variant="ghost" onPress={() => setConfirmRemove(false)} />
          </>
        ) : (
          <Button title="Remove content" variant="danger" disabled={busy} onPress={() => setConfirmRemove(true)} />
        )}
        <Button
          title="Dismiss"
          variant="ghost"
          disabled={busy}
          onPress={() => act(() => dismissReport(report), 'Dismiss failed')}
        />
      </View>
      {report.contentType === 'response' && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, color: theme.warning }}>
          Removing a reported response takes down the whole question thread.
        </ThemedText>
      )}
    </Card>
  );
}

function FeedbackCard({ item }: { item: Feedback }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={FEEDBACK_TOPICS.find((x) => x.key === item.topic)?.label ?? item.topic}
          tone={item.topic === 'childSafety' ? 'danger' : 'primary'}
        />
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {item.createdAt ? timeAgo(item.createdAt) : ''}
        </ThemedText>
      </View>
      <ThemedText type="small">{item.message}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
        {[item.email ?? 'no email', item.uid ?? 'signed out', item.platform, item.appVersion, item.locale]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>
      <Button
        title="Mark handled"
        variant="ghost"
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await markFeedbackHandled(item.id);
          } catch (e) {
            notifyError('Could not update', e);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}
