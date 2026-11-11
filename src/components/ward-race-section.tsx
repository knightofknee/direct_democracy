import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DistrictCells } from '@/components/district-cells';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field, SectionHeader } from '@/components/ui';
import { wardLabel } from '@/constants/chicago';
import {
  MUNICIPAL_2027_CITYWIDE,
  MUNICIPAL_2027_FILING,
  MUNICIPAL_ELECTION,
  MUNICIPAL_ELECTION_DATE,
  POLICE_DISTRICTS,
  VOTER_LOOKUP_URL,
} from '@/constants/elections';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { useTheme } from '@/hooks/use-theme';
import {
  findMyDistricts,
  rememberDeviceDistricts,
  useMyDistricts,
  type FindDistrictsResult,
} from '@/lib/districts';
import { db } from '@/lib/firebase';
import { notify, notifyError } from '@/lib/notify';
import { openLink } from '@/lib/open-link';
import type { ElectionCandidateCard } from '@/lib/types';
import { usePlural, useT } from '@/lib/i18n';

// The last ward race opened from the grid, so someone without a verified
// ward still gets a one-tap way back to the race they care about.
const LAST_WARD_KEY = 'wardRace.lastWard';

/**
 * Everything on the February 23, 2027 ballot besides the mayor (renamed
 * from "ward races" 2026-11-09, Brian: the section held two citywide
 * offices, a ward picker, and police districts that do not follow wards,
 * under a title that named one of the three). Three groups, each headed by
 * what decides whether a race is yours: citywide (everyone), your alderman
 * (your ward), your police district council (your address, found right
 * here or on the Board's sample ballot).
 */
export function WardRaceSection() {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const pluralT = usePlural();
  const { profile } = useAuth();

  const { data: candidates } = useLiveQuery<ElectionCandidateCard>(
    () =>
      query(collection(db, 'electionCandidates'), where('election', '==', MUNICIPAL_ELECTION)),
    []
  );
  const countByRace = new Map<string, number>();
  for (const c of candidates) countByRace.set(c.race, (countByRace.get(c.race) ?? 0) + 1);

  const verifiedWard =
    profile?.wardId != null && profile.wardId >= 1 && profile.wardId <= 50
      ? profile.wardId
      : null;

  const [lastWard, setLastWard] = useState<number | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(LAST_WARD_KEY)
      .then((v) => {
        const n = Number(v);
        if (Number.isInteger(n) && n >= 1 && n <= 50) setLastWard(n);
      })
      .catch(() => {});
  }, []);

  const openWard = (ward: number) => {
    setLastWard(ward);
    AsyncStorage.setItem(LAST_WARD_KEY, String(ward)).catch(() => {});
    router.push(`/ward-race/${ward}`);
  };

  // A home ward wins; otherwise the ward they last picked stands in.
  const myWard = verifiedWard ?? lastWard;
  const myWardTitle = verifiedWard != null ? t('Your ward') : t('Your last pick');

  return (
    <View style={{ gap: Spacing.three }}>
      <SectionHeader
        title={t('the rest of the ballot')}
        subtitle={`${t("Four more races share the {date} ballot with the mayor's: two citywide, one by your ward, and one by your address.").replace('{date}', t(MUNICIPAL_ELECTION_DATE))} ${t(MUNICIPAL_2027_FILING)}.`}
      />

      <GroupLabel text={t('citywide')} />
      {MUNICIPAL_2027_CITYWIDE.map((race) => (
        <Card key={race.id} onPress={() => router.push(`/election-race/${race.id}`)}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                {t(race.label)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {t(race.detail)}
                {countByRace.has(race.id)
                  ? ` · ${pluralT(countByRace.get(race.id)!, 'candidate')}`
                  : ''}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>
        </Card>
      ))}

      <GroupLabel text={t('your alderman')} />
      {myWard != null && (
        <Card onPress={() => openWard(myWard)}>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText type="smallBold" style={{ fontSize: 15 }}>
                {myWardTitle}: {wardLabel(myWard)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
                {t("Your alderman's record next to everyone running against them.")}
                {countByRace.has(`ward-${myWard}`)
                  ? ` · ${pluralT(countByRace.get(`ward-${myWard}`)!, 'candidate')}`
                  : ''}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>
        </Card>
      )}

      <Card>
        <ThemedText type="smallBold" style={{ fontSize: 13 }}>
          {t("Every ward's race")}
        </ThemedText>
        <View style={styles.grid}>
          {Array.from({ length: 50 }, (_, i) => i + 1).map((ward) => {
            const declared = countByRace.has(`ward-${ward}`);
            return (
              <Pressable
                key={ward}
                onPress={() => openWard(ward)}
                accessibilityRole="button"
                accessibilityLabel={t('{ward} race').replace('{ward}', wardLabel(ward))}
                style={({ pressed }) => [
                  styles.wardButton,
                  {
                    borderColor: declared ? theme.primary : theme.border,
                    backgroundColor: theme.background,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ fontSize: 14, color: declared ? theme.primary : theme.text }}>
                  {ward}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Highlighted wards have declared candidates on record.')}
        </ThemedText>
      </Card>

      <GroupLabel text={t('your police district council')} />
      <PoliceDistricts has={(d) => countByRace.has(`pdc-${d}`)} />
    </View>
  );
}

/** What decides whether the races under it are yours. */
function GroupLabel({ text }: { text: string }) {
  return (
    <ThemedText
      type="smallBold"
      themeColor="textSecondary"
      accessibilityRole="header"
      style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.one }}>
      {text}
    </ThemedText>
  );
}

/**
 * The police district councils, with the two ways to learn which one is
 * yours (2026-11-09, Brian: the card said "your sample ballot names yours"
 * and offered neither a lookup nor the ballot). An address typed here finds
 * the district in one step, signed in or not: signed in, the numbers are
 * kept on the account like any district lookup; signed out, the server
 * keeps nothing and they stay on this phone. The Board's own lookup, which
 * shows the sample ballot, is linked beside it.
 */
function PoliceDistricts({ has }: { has: (district: number) => boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const t = useT();
  const { profile } = useAuth();
  const mine = useMyDistricts();
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [again, setAgain] = useState(false);
  const [miss, setMiss] = useState<Exclude<FindDistrictsResult, { result: 'ok' }> | null>(null);

  const find = async () => {
    if (busy || address.trim().length < 5) return;
    setBusy(true);
    setMiss(null);
    try {
      const r = await findMyDistricts(address.trim());
      if (r.result === 'ok') {
        // Signed in, the account now carries them; signed out, this phone does.
        if (!profile) rememberDeviceDistricts({ ...r.districts, wardId: r.wardId });
        setAddress('');
        setAgain(false);
        return;
      }
      setMiss(r);
    } catch (e) {
      if ((e as { code?: string }).code === 'functions/resource-exhausted') {
        notify(
          t('Could not look up that address'),
          t(
            profile
              ? 'You can look up 5 addresses a day. Try again tomorrow.'
              : 'Too many address lookups today. Sign in to look up yours, or try again tomorrow.'
          )
        );
        return;
      }
      notifyError(t('Could not look up that address'), e);
    } finally {
      setBusy(false);
    }
  };

  const showField = !mine.exact || again;

  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 13, lineHeight: 19 }}>
        {t('Three elected seats in each of the 22 police districts. Police districts do not follow ward lines, so yours goes by your address.')}
      </ThemedText>

      {showField ? (
        <>
          <Field
            value={address}
            onChangeText={(v) => {
              setAddress(v);
              setMiss(null);
            }}
            placeholder={t('1234 N Clark St')}
            accessibilityLabel={t('Your home address')}
            autoComplete="street-address"
            textContentType="fullStreetAddress"
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={() => void find()}
            maxLength={200}
          />
          {miss && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {miss.result === 'notFound'
                ? t('We couldn’t find that address. Check the street number and name.')
                : miss.result === 'outside'
                  ? t('That address is outside Chicago.')
                  : t(
                      miss.verified
                        ? 'That address is in the {ward}, and your verified ward is the {home}. If you moved, verify your new address in Settings.'
                        : 'That address is in the {ward}, and your home ward is the {home}. Change your home ward first, then look up the address.'
                    )
                      .replace('{ward}', wardLabel(miss.wardId))
                      .replace('{home}', wardLabel(profile?.wardId))}
            </ThemedText>
          )}
          <Button
            title={t('Find my police district')}
            icon={<Ionicons name="search" size={15} color="#FFFFFF" />}
            onPress={() => void find()}
            loading={busy}
            disabled={address.trim().length < 5}
          />
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12, lineHeight: 17 }}>
            {t('The address goes to the US Census Bureau to place it on the map. Only the district numbers are kept, never the address.')}
          </ThemedText>
        </>
      ) : null}

      <DistrictCells
        all={POLICE_DISTRICTS}
        mine={mine.of('police')}
        exact={mine.exact}
        onOpen={(d) => router.push(`/election-race/pdc-${d}`)}
        cellLabel={(d) => t('Police District {n} council race').replace('{n}', String(d))}
        highlighted={has}
        cellStyle={{ width: '8.5%', flexGrow: 1 }}
      />

      {mine.exact && !again && (
        <Pressable onPress={() => setAgain(true)} hitSlop={8} accessibilityRole="button">
          <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
            {t('Look up a different address')}
          </ThemedText>
        </Pressable>
      )}
      <Pressable onPress={() => void openLink(VOTER_LOOKUP_URL)} hitSlop={8} accessibilityRole="link">
        <ThemedText type="smallBold" style={{ color: theme.primary, fontSize: 13 }}>
          {t('Or see it on your sample ballot (Board of Elections)')}
        </ThemedText>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  wardButton: {
    width: '8.5%',
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 8,
  },
});
