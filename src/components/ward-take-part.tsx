import { Ionicons } from '@expo/vector-icons';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Chip, SectionHeader } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { WARD_DISTRICTS } from '@/constants/ward-districts';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import { db } from '@/lib/firebase';
import { useLocalized, useT } from '@/lib/i18n';
import { openDirections, openLink } from '@/lib/open-link';
import type { CivicMeeting, NewsletterIssue, Official, WardMeeting, ZoningItem } from '@/lib/types';
import { formatDay, formatWhen } from '@/lib/ward-posting';

/** The City Clerk's page on giving public comment (Council and its committees). */
const PUBLIC_COMMENT_URL = 'https://www.chicityclerk.com/public-comment-process';
const ZBA_PARTICIPATION_URL =
  'https://www.chicago.gov/content/city/en/depts/dcd/zoning-board-of-appeals/public-participation.html';
/** CPD's calendar of beat (CAPS) meetings; it blocks automated reads, so it is linked, not synced. */
const BEAT_MEETINGS_URL = 'https://www.chicagopolice.org/community-engagement-calendar/';
const REPORT_311_URL = 'https://311.chicago.gov';
const ZONING_SHOWN = 4;

const BODY_SHORT: Record<string, string> = {
  'Committee on Zoning, Landmarks and Building Standards': 'Committee on Zoning',
  'Zoning Board of Appeals': 'Zoning Board of Appeals',
  'Chicago Plan Commission': 'Plan Commission',
};

/**
 * Everything else a resident needs to take part in their ward, under the
 * alderman on the ward page (2026-10-05): the meetings the ward office
 * announces in its newsletter, the zoning changes and hearings in the ward,
 * the police district councils that cover it, and the ward office itself.
 * All of it public record, synced (zoning, police councils) or read from
 * the ward's own newsletter; nothing here is entered by users.
 */
export function WardTakePart({ wardId, alderman }: { wardId: number; alderman: Official | undefined }) {
  const t = useT();
  return (
    <>
      <SectionHeader
        title={t('Take part')}
        subtitle={t('Where decisions about this ward get made, and when you can be heard.')}
      />
      <WardMeetingsCard wardId={wardId} phone={alderman?.phone ?? null} />
      <ZoningCard wardId={wardId} />
      <PoliceCouncilCard wardId={wardId} />
      {alderman && <WardOfficeCard wardId={wardId} alderman={alderman} />}
    </>
  );
}

function CardTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.cardTitle}>
      <Ionicons name={icon} size={16} color={theme.primary} />
      <ThemedText type="smallBold" accessibilityRole="header" style={{ fontSize: 14, flex: 1 }}>
        {title}
      </ThemedText>
    </View>
  );
}

function LinkLine({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={6} style={styles.linkLine}>
      <Ionicons name={icon} size={14} color={theme.primary} style={{ marginTop: 2 }} />
      <ThemedText type="small" style={{ fontSize: 13, color: theme.primary, fontWeight: '600', flex: 1 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Ward nights, community meetings on proposed projects, town halls: from the
 * ward newsletter. Meetings it announces without a time follow under "Time
 * not found in the newsletter" (2026-10-12), with the office's phone: the
 * time may well be set, the newsletter just doesn't say it.
 */
function WardMeetingsCard({ wardId, phone }: { wardId: number; phone: string | null }) {
  const t = useT();
  const [now] = useState(() => new Date());
  const { data: meetings } = useLiveQuery<WardMeeting>(
    () =>
      query(
        collection(db, 'wardMeetings'),
        where('wardId', '==', wardId),
        where('start', '>=', now),
        orderBy('start', 'asc'),
        limit(8)
      ),
    [wardId]
  );
  const { data: undatedAll } = useLiveQuery<WardMeeting>(
    () => query(collection(db, 'wardMeetings'), where('wardId', '==', wardId), where('start', '==', null)),
    [wardId]
  );
  // The script clears expired ones once a day; between runs, hide them here.
  const undated = undatedAll
    .filter((m) => !m.expiresAt || m.expiresAt.toMillis() > now.getTime())
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.title.localeCompare(b.title));
  if (meetings.length === 0 && undated.length === 0) return null;
  return (
    <Card>
      <CardTitle icon="people-outline" title={t('Ward meetings')} />
      {meetings.map((m) => (
        <MeetingRow key={m.id} meeting={m} when={formatWhen(m.start!.toDate())} />
      ))}
      {meetings.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('As announced in the ward office’s newsletter. Tap a meeting for its details or RSVP.')}
        </ThemedText>
      )}
      {undated.length > 0 && (
        <>
          <ThemedText type="smallBold" accessibilityRole="header" style={{ fontSize: 13, marginTop: Spacing.one }}>
            {t('Time not found in the newsletter')}
          </ThemedText>
          {undated.map((m) => (
            <MeetingRow
              key={m.id}
              meeting={m}
              when={m.date ? t('{date}, time not found').replace('{date}', formatDay(m.date)) : t('Date and time not found')}
            />
          ))}
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('The ward office’s newsletter mentions these without a time. The office can tell you when they meet.')}
          </ThemedText>
          {phone ? (
            <LinkLine
              icon="call-outline"
              label={t('Call the ward office: {phone}').replace('{phone}', phone)}
              onPress={() => void Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`)}
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

function MeetingRow({ meeting: m, when }: { meeting: WardMeeting; when: string }) {
  const t = useT();
  const theme = useTheme();
  return (
    <Pressable
      onPress={m.url ? () => void openLink(m.url!) : undefined}
      accessibilityRole={m.url ? 'link' : undefined}
      style={styles.item}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' }}>
        <ThemedText type="smallBold" style={{ fontSize: 14, lineHeight: 19, flexShrink: 1 }}>
          {m.title}
        </ThemedText>
        {m.kind === 'development' && <Chip label={t('Development')} icon="construct-outline" />}
        {m.online && <Chip label={t('Online')} icon="videocam-outline" />}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
        {when}
      </ThemedText>
      {m.place ? (
        <ThemedText
          type="small"
          style={{ fontSize: 12, color: m.address ? theme.primary : theme.textSecondary }}
          onPress={m.address ? () => void openDirections(m.address!) : undefined}>
          {m.place}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function zoningOrder(a: ZoningItem, b: ZoningItem): number {
  // Hearings coming up first, soonest first; then filings, newest first.
  const ah = a.hearing?.date.toMillis();
  const bh = b.hearing?.date.toMillis();
  if (ah != null && bh != null) return ah - bh;
  if (ah != null) return -1;
  if (bh != null) return 1;
  return (b.filedAt?.toMillis() ?? 0) - (a.filedAt?.toMillis() ?? 0);
}

/** Zoning changes and development hearings in the ward, and how to speak at each. */
function ZoningCard({ wardId }: { wardId: number }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [now] = useState(() => Date.now());
  const { data, loading } = useLiveQuery<ZoningItem>(
    () => query(collection(db, 'zoningItems'), where('wardIds', 'array-contains', wardId)),
    [wardId]
  );
  // The sync runs twice a day; a hearing that has started is past.
  const items = data.filter((i) => !i.hearing || i.hearing.date.toMillis() > now).sort(zoningOrder);
  const shown = expanded ? items : items.slice(0, ZONING_SHOWN);
  const bodies = new Set(items.map((i) => i.hearing?.body).filter(Boolean));
  const cpc = items.find((i) => i.source === 'cpc');

  if (loading) return null;
  return (
    <Card>
      <CardTitle icon="business-outline" title={t('Development and zoning')} />
      {items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13 }}>
          {t('No zoning changes or development hearings are pending in this ward right now.')}
        </ThemedText>
      ) : (
        shown.map((item) => <ZoningRow key={item.id} item={item} now={now} />)
      )}
      {items.length > ZONING_SHOWN && (
        <LinkLine
          icon={expanded ? 'chevron-up' : 'chevron-down'}
          label={expanded ? t('Show fewer') : t('Show all {n}').replace('{n}', String(items.length))}
          onPress={() => setExpanded((e) => !e)}
        />
      )}
      {bodies.has('Committee on Zoning, Landmarks and Building Standards') && (
        <View style={styles.howTo}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
            {t('Committee on Zoning hearings: anyone may speak for up to 3 minutes in the public comment period, or send written comment by the deadline.')}
          </ThemedText>
          <LinkLine icon="megaphone-outline" label={t('How to give public comment')} onPress={() => void openLink(PUBLIC_COMMENT_URL)} />
        </View>
      )}
      {bodies.has('Zoning Board of Appeals') && (
        <View style={styles.howTo}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
            {t('Zoning Board of Appeals: anyone may comment by signing in on the day. Owners within 100 feet (variations) or 250 feet (special uses) can register by 9 AM the Tuesday before to question the applicant.')}
          </ThemedText>
          <LinkLine
            icon="document-text-outline"
            label={t('Zoning Board of Appeals participation rules')}
            onPress={() => void openLink(ZBA_PARTICIPATION_URL)}
          />
        </View>
      )}
      {cpc?.hearing?.agendaUrl && (
        <LinkLine
          icon="document-text-outline"
          label={t('Plan Commission hearing page')}
          onPress={() => void openLink(cpc.hearing!.agendaUrl!)}
        />
      )}
    </Card>
  );
}

function ZoningRow({ item, now }: { item: ZoningItem; now: number }) {
  const t = useT();
  const kind =
    item.source === 'cpc'
      ? t('Planned Development')
      : item.source === 'zba'
        ? item.kind === 'special-use'
          ? t('Special use')
          : t('Variation')
        : t('Zoning change');
  const what = item.purpose ?? item.changeRequest ?? null;
  const url = item.url ?? item.hearing?.agendaUrl ?? null;
  const deadline = item.hearing?.commentDeadline;
  return (
    <Pressable
      onPress={url ? () => void openLink(url) : undefined}
      accessibilityRole={url ? 'link' : undefined}
      style={styles.item}>
      <ThemedText type="smallBold" style={{ fontSize: 14, lineHeight: 19 }}>
        {item.address ?? item.title ?? kind}
      </ThemedText>
      {/* A teaser: the full text is one tap away at the source. */}
      <ThemedText type="small" style={{ fontSize: 13, lineHeight: 18 }} numberOfLines={3}>
        {what ? `${kind}: ${what}` : kind}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
        {item.hearing
          ? t('Hearing: {body}, {when}')
              .replace('{body}', t(BODY_SHORT[item.hearing.body] ?? item.hearing.body))
              .replace('{when}', formatWhen(item.hearing.date.toDate()))
          : item.filedAt
            ? // The Clerk dates a filing by the Council meeting that introduces
              // it, which can still be ahead (2026-10-09).
              item.filedAt.toMillis() > now
              ? t('Goes to the City Council on {date}. No hearing set yet.').replace('{date}', formatWhen(item.filedAt.toDate(), false))
              : t('Filed {date}. No hearing set yet.').replace('{date}', formatWhen(item.filedAt.toDate(), false))
            : t('No hearing set yet.')}
      </ThemedText>
      {deadline && deadline.toMillis() > now && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
          {t('Written comment deadline: {date}').replace('{date}', formatWhen(deadline.toDate()))}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** The next meeting of each police district council that covers the ward. */
function PoliceCouncilCard({ wardId }: { wardId: number }) {
  const t = useT();
  const { profile } = useAuth();
  const [now] = useState(() => Date.now());
  const wardDistricts = WARD_DISTRICTS[wardId]?.police ?? [];
  // The viewer's own district leads when their address is on file here.
  const mine = profile?.districts?.wardId === wardId ? profile.districts.police : null;
  const districts = mine != null ? [mine, ...wardDistricts.filter((d) => d !== mine)] : wardDistricts;
  const { data } = useLiveQuery<CivicMeeting>(
    () =>
      districts.length
        ? query(collection(db, 'civicMeetings'), where('policeDistrict', 'in', districts.slice(0, 30)))
        : null,
    [districts.join(',')]
  );
  if (districts.length === 0) return null;
  const next = districts
    .map((d) =>
      data
        .filter((m) => m.policeDistrict === d && m.start.toMillis() > now)
        .sort((a, b) => a.start.toMillis() - b.start.toMillis())[0]
    )
    .filter((m): m is CivicMeeting => !!m);

  return (
    <Card>
      <CardTitle icon="shield-outline" title={t('Police district councils')} />
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
        {t(
          districts.length === 1
            ? 'This ward is in police district {list}. Its elected council holds public meetings on policing in the district.'
            : 'This ward spans police districts {list}. Each has an elected council that holds public meetings on policing in the district.'
        ).replace('{list}', districts.join(', '))}
      </ThemedText>
      {next.map((m) => (
        <Pressable key={m.id} onPress={() => void openLink(m.url)} accessibilityRole="link" style={styles.item}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' }}>
            <ThemedText type="smallBold" style={{ fontSize: 14 }}>
              {t('District {n} council').replace('{n}', String(m.policeDistrict))}
            </ThemedText>
            {m.policeDistrict === mine && <Chip label={t('Your district')} tone="primary" />}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {formatWhen(m.start.toDate())}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {m.venue ? [m.venue, m.address].filter(Boolean).join(', ') : t('Place to be announced')}
          </ThemedText>
        </Pressable>
      ))}
      <LinkLine
        icon="calendar-outline"
        label={t('Beat meetings with your district’s officers (CPD calendar)')}
        onPress={() => void openLink(BEAT_MEETINGS_URL)}
      />
    </Card>
  );
}

/** The ward office: where it is, how to reach it, and its latest newsletter. */
function WardOfficeCard({ wardId, alderman }: { wardId: number; alderman: Official }) {
  const t = useT();
  const loc = useLocalized();
  const theme = useTheme();
  const { data: issues } = useLiveQuery<NewsletterIssue>(
    () =>
      query(collection(db, 'newsletterIssues'), where('wardId', '==', wardId), orderBy('sentAt', 'desc'), limit(1)),
    [wardId]
  );
  const latest = issues[0];
  return (
    <Card>
      <CardTitle icon="home-outline" title={t('Ward office')} />
      {alderman.officeHours ? (
        <ThemedText type="small" style={{ fontSize: 13, lineHeight: 18 }}>
          {loc(alderman.officeHours.text, alderman.officeHours.textEs)}
        </ThemedText>
      ) : null}
      {(alderman.officeAddresses ?? []).map((a) => (
        <LinkLine key={a} icon="location-outline" label={a} onPress={() => void openDirections(a)} />
      ))}
      {alderman.phone ? (
        <LinkLine
          icon="call-outline"
          label={alderman.phone}
          onPress={() => void Linking.openURL(`tel:${alderman.phone!.replace(/[^+\d]/g, '')}`)}
        />
      ) : null}
      {alderman.contactEmail ? (
        <LinkLine
          icon="mail-outline"
          label={alderman.contactEmail}
          onPress={() => void Linking.openURL(`mailto:${alderman.contactEmail}`)}
        />
      ) : null}
      {alderman.newsletterUrl ? (
        <LinkLine icon="newspaper-outline" label={t('Ward newsletter')} onPress={() => void openLink(alderman.newsletterUrl!)} />
      ) : null}
      {latest && (
        <Pressable
          onPress={latest.url ? () => void openLink(latest.url!) : undefined}
          accessibilityRole={latest.url ? 'link' : undefined}
          style={[styles.summary, { borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
            {t('AI summary of the {date} newsletter').replace('{date}', formatWhen(latest.sentAt.toDate(), false))}
          </ThemedText>
          <ThemedText type="small" style={{ fontSize: 14, lineHeight: 20 }}>
            {loc(latest.summary, latest.summaryEs)}
          </ThemedText>
          {latest.url ? (
            <ThemedText type="small" style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>
              {t('Read the newsletter')}
            </ThemedText>
          ) : null}
        </Pressable>
      )}
      <LinkLine icon="construct-outline" label={t('Report a city service problem to 311')} onPress={() => void openLink(REPORT_311_URL)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  item: {
    gap: 2,
  },
  linkLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  howTo: {
    gap: 4,
  },
  summary: {
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
});
