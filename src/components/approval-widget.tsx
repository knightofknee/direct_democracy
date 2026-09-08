import { Ionicons } from '@expo/vector-icons';
import { doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { tapHaptic } from '@/lib/haptics';
import { notifyError } from '@/lib/notify';
import { useOptimistic } from '@/lib/optimistic';
import { emptyTally, withBallotDelta } from '@/lib/tally';
import type { ApprovalValue, Official } from '@/lib/types';
import { APPROVAL_MIN_BALLOTS, computeApproval, setApproval } from '@/services/officials';

/**
 * The "how well liked" axis: a standing approve/disapprove any VERIFIED
 * resident can set or flip at any time. The ballot is verified-only (a
 * rating anonymous accounts could stuff would be worthless); unverified
 * users see the buttons grayed with the path to verifying. Constituent
 * approval is the number that grades; the all-users line keeps the
 * pre-gate history honest.
 */
export function ApprovalWidget({ official }: { official: Official }) {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();

  const { data: mine } = useLiveDoc<{ value: ApprovalValue }>(
    () => (profile ? doc(db, 'officials', official.uid, 'approvals', profile.uid) : null),
    [official.uid, profile?.uid]
  );

  // Assume success: the approval bars move the instant they tap, handed
  // back to the server numbers when onApprovalWrite lands.
  const agg = useOptimistic({
    tallies: official.approvalTallies ?? emptyTally(),
    constituents: official.approvalConstituents ?? { approve: 0, disapprove: 0 },
  });
  const rating = computeApproval({
    ...official,
    approvalTallies: agg.value.tallies,
    approvalConstituents: agg.value.constituents,
  });
  const isSelf = profile?.uid === official.uid;
  // Signed out can still tap (it routes to sign-in); a signed-in account
  // without a verified ward gets inactive buttons and the verify path.
  const unverified = profile != null && (!profile.verified || profile.wardId == null);

  const cast = (value: ApprovalValue) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    if (mine?.value === value) return;
    tapHaptic();
    const prev = mine?.value ?? null;
    // Mirror of onApprovalWrite: constituents are verified residents of the
    // official's ward (any verified resident for citywide offices).
    const isConstituent =
      !!profile.verified && (official.wardId == null || profile.wardId === official.wardId);
    const constituents = { ...(official.approvalConstituents ?? { approve: 0, disapprove: 0 }) };
    if (isConstituent) {
      if (prev) constituents[prev] = Math.max(0, (constituents[prev] ?? 0) - 1);
      constituents[value] = (constituents[value] ?? 0) + 1;
    }
    agg.predict({
      tallies: withBallotDelta(official.approvalTallies ?? emptyTally(), {
        from: prev,
        to: value,
        verified: !!profile.verified,
      }),
      constituents,
    });
    setApproval(profile, official.uid, value).catch((e) => {
      agg.rollback();
      notifyError('Could not record approval', e);
    });
  };

  return (
    <View style={{ gap: Spacing.two }}>
      {!isSelf && (
        <>
          <View style={[styles.buttonRow, unverified && { opacity: 0.45 }]}>
            <ApprovalButton
              label="Approve"
              icon="thumbs-up"
              selected={mine?.value === 'approve'}
              color={theme.verified}
              softColor={theme.verifiedSoft}
              disabled={unverified}
              onPress={() => cast('approve')}
            />
            <ApprovalButton
              label="Disapprove"
              icon="thumbs-down"
              selected={mine?.value === 'disapprove'}
              color={theme.danger}
              softColor={theme.dangerSoft}
              disabled={unverified}
              onPress={() => cast('disapprove')}
            />
          </View>
          {unverified && (
            <Pressable
              onPress={() => router.push('/verify')}
              hitSlop={6}
              accessibilityRole="link"
              style={styles.verifyRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={theme.primary} />
              <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
                Approval votes are for verified residents - verify to grade your officials
              </ThemedText>
            </Pressable>
          )}
        </>
      )}
      {/* Only the graded number: with the ballot verified-only, an all-users
          line would differ from this one by pre-gate ballots alone. */}
      <RatingLine
        label="Constituents"
        pctValue={rating.constituentPct}
        detail={
          rating.constituentPct == null
            ? `${rating.constituentBallots} of ${APPROVAL_MIN_BALLOTS} verified ward votes needed`
            : `${rating.constituentBallots} verified ward vote${rating.constituentBallots === 1 ? '' : 's'}`
        }
        emphasized
      />
    </View>
  );
}

function ApprovalButton({
  label,
  icon,
  selected,
  color,
  softColor,
  disabled,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  color: string;
  softColor: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.approvalButton,
        {
          borderColor: selected ? color : theme.border,
          backgroundColor: selected ? softColor : theme.background,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Ionicons name={icon} size={16} color={selected ? color : theme.textSecondary} />
      <ThemedText
        type="small"
        style={{ color: selected ? color : theme.text, fontWeight: selected ? '700' : '500' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function RatingLine({
  label,
  pctValue,
  detail,
  emphasized,
}: {
  label: string;
  pctValue: number | null;
  detail: string | null;
  emphasized?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 3 }}>
      <View style={styles.ratingRow}>
        <ThemedText type={emphasized ? 'smallBold' : 'small'} style={{ fontSize: 13 }}>
          {label}
        </ThemedText>
        <ThemedText
          type={emphasized ? 'smallBold' : 'small'}
          style={{ fontSize: 13 }}
          themeColor={pctValue == null ? 'textSecondary' : undefined}>
          {pctValue == null ? '-' : `${pctValue}% approve`}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        {pctValue != null && (
          <View
            style={[
              styles.fill,
              {
                width: `${pctValue}%`,
                backgroundColor:
                  pctValue >= 60 ? theme.verified : pctValue >= 40 ? theme.warning : theme.danger,
              },
            ]}
          />
        )}
      </View>
      {detail != null && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
          {detail}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  approvalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 11,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
