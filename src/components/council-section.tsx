import { Ionicons } from '@expo/vector-icons';
import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useLiveDoc, useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { useT } from '@/lib/i18n';
import { openLink } from '@/lib/open-link';
import type { CouncilMeeting, RollCall } from '@/lib/types';
import { formatWhen } from '@/lib/ward-posting';

/** The City Clerk's page on how to give public comment. */
const PUBLIC_COMMENT_URL = 'https://www.chicityclerk.com/public-comment-process';
/** Where every piece of Council legislation lives. */
const ELMS_URL = 'https://chicityclerkelms.chicago.gov/';
const MEETINGS_SHOWN = 4;
const VOTES_SHOWN = 5;

/**
 * What City Council is deciding, on the home tab under the big board: the
 * next meetings (Council and committees) with their public comment
 * deadlines, and the Council's recent split votes. All of it synced from
 * the City Clerk (syncCouncil in functions); titles as the Clerk writes
 * them, tallies as recorded.
 */
export function CouncilSection() {
  const t = useT();
  const { data: upcoming } = useLiveDoc<{ meetings?: CouncilMeeting[] }>(() => doc(db, 'council', 'upcoming'), []);
  const { data: splitVotes } = useLiveQuery<RollCall>(
    () =>
      query(
        collection(db, 'rollCalls'),
        where('council', '==', true),
        where('divided', '==', true),
        orderBy('date', 'desc'),
        limit(VOTES_SHOWN)
      ),
    []
  );
  // The sync runs twice a day; a meeting that has started is no longer
  // "coming up", whatever the last sync said.
  const [now] = useState(() => Date.now());
  const meetings = (upcoming?.meetings ?? [])
    .filter((m) => !m.cancelled && m.date.toMillis() > now)
    .slice(0, MEETINGS_SHOWN);
  if (meetings.length === 0 && splitVotes.length === 0) return null;

  return (
    <>
      <SectionHeader
        title={t('City Council')}
        subtitle={t('What the Council is deciding, and when you can speak up.')}
      />
      {meetings.length > 0 && (
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 13 }}>
            {t('Coming up')}
          </ThemedText>
          {meetings.map((m) => (
            <MeetingRow key={m.meetingId} meeting={m} now={now} />
          ))}
          <LinkLine icon="megaphone-outline" label={t('How to give public comment')} url={PUBLIC_COMMENT_URL} />
        </Card>
      )}
      {splitVotes.length > 0 && (
        <Card>
          <ThemedText type="smallBold" style={{ fontSize: 13 }}>
            {t('Recent split votes')}
          </ThemedText>
          {splitVotes.map((v) => (
            <Pressable key={v.id} onPress={() => void openLink(v.url)} accessibilityRole="link" style={styles.voteRow}>
              <ThemedText type="small" style={{ fontSize: 14, lineHeight: 19 }}>
                {v.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {`${t(v.actionName)} ${v.yes}-${v.no} · ${formatWhen(v.date.toDate(), false)}`}
              </ThemedText>
            </Pressable>
          ))}
          <LinkLine icon="document-text-outline" label={t('All Council legislation')} url={ELMS_URL} />
        </Card>
      )}
    </>
  );
}

function MeetingRow({ meeting, now }: { meeting: CouncilMeeting; now: number }) {
  const theme = useTheme();
  const t = useT();
  const council = meeting.body === 'City Council';
  return (
    <View style={styles.meetingRow}>
      <Ionicons name={council ? 'business' : 'people-outline'} size={16} color={theme.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold" style={{ fontSize: 14 }}>
          {council ? t('City Council meeting') : meeting.body}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {formatWhen(meeting.date.toDate())}
        </ThemedText>
        {meeting.publicCommentDeadline && (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {meeting.publicCommentDeadline.toMillis() > now
              ? t('Public comment deadline: {date}').replace('{date}', formatWhen(meeting.publicCommentDeadline.toDate()))
              : t('Public comment sign-up has closed')}
          </ThemedText>
        )}
        {(meeting.agendaUrl ?? meeting.noticeUrl) && (
          <Pressable
            onPress={() => void openLink((meeting.agendaUrl ?? meeting.noticeUrl)!)}
            accessibilityRole="link"
            hitSlop={6}>
            <ThemedText type="small" style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>
              {meeting.agendaUrl ? t('Agenda') : t('Meeting notice')}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function LinkLine({ icon, label, url }: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string }) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => void openLink(url)} accessibilityRole="link" hitSlop={6} style={styles.linkLine}>
      <Ionicons name={icon} size={14} color={theme.primary} />
      <ThemedText type="small" style={{ fontSize: 13, color: theme.primary, fontWeight: '600', flex: 1 }}>
        {label}
      </ThemedText>
      <Ionicons name="open-outline" size={12} color={theme.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  meetingRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  voteRow: {
    gap: 2,
  },
  linkLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
});
