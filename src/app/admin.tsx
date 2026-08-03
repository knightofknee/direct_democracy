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
    </Screen>
  );
}

function ReportCard({ report }: { report: Report }) {
  const theme = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const route = reportContentRoute(report);
  const reasonLabel = REPORT_REASONS.find((x) => x.key === report.reason)?.label ?? report.reason;

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
        <Chip label={reasonLabel} tone="warning" />
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {timeAgo(report.createdAt)}
        </ThemedText>
      </View>
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
