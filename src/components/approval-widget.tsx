import { Ionicons } from '@expo/vector-icons';
import { doc } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveDoc } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { notifyError } from '@/lib/notify';
import type { ApprovalValue, Official } from '@/lib/types';
import { computeApproval, setApproval } from '@/services/officials';

/**
 * The "how well liked" axis: a standing approve/disapprove that any user can
 * set or flip at any time. Constituent approval is the number that grades;
 * the all-users number is shown alongside for honesty.
 */
export function ApprovalWidget({ official }: { official: Official }) {
  const theme = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);

  const { data: mine } = useLiveDoc<{ value: ApprovalValue }>(
    () => (profile ? doc(db, 'officials', official.uid, 'approvals', profile.uid) : null),
    [official.uid, profile?.uid]
  );

  const rating = computeApproval(official);
  const isSelf = profile?.uid === official.uid;

  const cast = async (value: ApprovalValue) => {
    if (!profile) {
      router.push('/sign-in');
      return;
    }
    if (mine?.value === value) return;
    setBusy(true);
    try {
      await setApproval(profile, official.uid, value);
    } catch (e) {
      notifyError('Could not record approval', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: Spacing.two }}>
      {!isSelf && (
        <View style={styles.buttonRow}>
          <ApprovalButton
            label="Approve"
            icon="thumbs-up"
            selected={mine?.value === 'approve'}
            color={theme.verified}
            softColor={theme.verifiedSoft}
            disabled={busy}
            onPress={() => cast('approve')}
          />
          <ApprovalButton
            label="Disapprove"
            icon="thumbs-down"
            selected={mine?.value === 'disapprove'}
            color={theme.danger}
            softColor={theme.dangerSoft}
            disabled={busy}
            onPress={() => cast('disapprove')}
          />
        </View>
      )}
      <View style={{ gap: 4 }}>
        <RatingLine
          label="Constituents"
          pctValue={rating.constituentPct}
          detail={
            rating.constituentPct == null
              ? `${rating.constituentBallots} ballot${rating.constituentBallots === 1 ? '' : 's'} — needs 5 to grade`
              : `${rating.constituentBallots} verified ward ballots`
          }
          emphasized
        />
        <RatingLine
          label="All users"
          pctValue={rating.allPct}
          detail={`${rating.allBallots} ballot${rating.allBallots === 1 ? '' : 's'}`}
        />
      </View>
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
  detail: string;
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
          {pctValue == null ? '—' : `${pctValue}% approve`}
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
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, lineHeight: 14 }}>
        {detail}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.two,
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
