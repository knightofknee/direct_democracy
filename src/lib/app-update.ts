// Version check for the update nudge (src/components/update-modal.tsx).
// Same design as Brian's other apps (bekin, Escape from Hades IRL).
//
// SOURCE OF TRUTH: our own config/app doc, NOT the iTunes lookup API. The App
// Store's public version name and the binary's own version (what EAS stamps
// from app.json) can be different numbering schemes, so comparing the binary
// against the store listing can nag every up-to-date user forever. Instead,
// config/app carries `latestVersion` on the BINARY scheme, flipped by hand
// (npm run set-latest-version) once a release is confirmed live in the store.
// That also kills the release-day window where Apple's lookup reports a
// version the store CDN won't actually hand over yet: the field changes only
// once the store really serves the update, so the Update button never leads
// to a dead end.
//
// ANDROID compares the build number (versionCode), not the version name:
// Android builds only bump versionCode (eas.json autoIncrement), and the name
// only moves when an iOS build bumps app.json, so several Play releases share
// one name. It gets its own dials, androidLatestBuild / androidMinBuild, which
// also lets each store be flipped when IT goes live. Android builds up to
// versionCode 8 predate this and still read latestVersion / minVersion.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { doc, getDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import { db } from '@/lib/firebase';

export type AppUpdateInfo = {
  /**
   * The release this build is behind: config/app.latestVersion on iOS (e.g.
   * "1.0.9"), "android build N" on Android. Keys the snooze.
   */
  latestVersion: string;
  /** Link to this platform's store listing. */
  storeUrl: string;
  /**
   * True when the installed binary is older than config/app.minVersion
   * (androidMinBuild on Android): the
   * prompt cannot be closed or snoozed, only Update. For builds whose
   * behavior the backend can no longer safely support (a security rule that
   * would surface as a raw error, a data shape they cannot read).
   */
  required: boolean;
  /** Per-release copy in Brian's voice for BOTH cards (config/app.updateMessage / updateMessageEs). */
  message?: { en: string; es?: string };
};

/**
 * Returns true when `latest` is a strictly newer dotted version than
 * `installed`. Missing segments count as 0 ("1.1" vs "1.1.0" is equal).
 * Non-numeric segments make the comparison bail to false - never prompt
 * on garbage data.
 */
export function isNewerVersion(latest: string, installed: string): boolean {
  const a = latest.split('.');
  const b = installed.split('.');
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] === undefined ? 0 : Number(a[i]);
    const y = b[i] === undefined ? 0 : Number(b[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/**
 * True when a whole-number build `target` (config/app androidLatestBuild /
 * androidMinBuild) is above the running build number. Anything that isn't a
 * positive whole number on either side bails to false: never prompt on
 * garbage data.
 */
export function isOlderBuild(target: unknown, installed: string | null | undefined): boolean {
  const have = Number(installed);
  if (typeof target !== 'number' || !Number.isInteger(target) || target <= 0) return false;
  if (!installed || !Number.isInteger(have) || have <= 0) return false;
  return have < target;
}

/**
 * Whether this build sits below one of config/app's dials ('latest' warns,
 * 'min' blocks), on this platform's scheme. Resolves the dial's release id
 * when it does, null when current or the dial is unset.
 */
export function behindDial(data: Record<string, unknown> | undefined, dial: 'latest' | 'min'): string | null {
  if (Platform.OS === 'android') {
    const target = data?.[dial === 'latest' ? 'androidLatestBuild' : 'androidMinBuild'];
    return isOlderBuild(target, Application.nativeBuildVersion) ? `android build ${target}` : null;
  }
  const raw = data?.[dial === 'latest' ? 'latestVersion' : 'minVersion'];
  const target = typeof raw === 'string' ? raw.trim() : '';
  const installed = Application.nativeApplicationVersion;
  return target && installed && isNewerVersion(target, installed) ? target : null;
}

// Dismissing the nudge is a snooze, not a mute: Close (or an Update tap) buys
// quiet for a day, then the nagging resumes until the user is actually
// current. Persisted so a relaunch doesn't reset the clock.
export const DISMISS_SNOOZE_MS = 24 * 60 * 60 * 1000;
const DISMISS_KEY = 'appUpdate.dismissed';

export type DismissRecord = {
  /** The latest-version string that was dismissed. */
  version: string;
  /** Epoch ms when it was dismissed. */
  at: number;
};

/**
 * True while a previously dismissed version should stay quiet: same version,
 * dismissed less than DISMISS_SNOOZE_MS ago. A newer release prompts
 * immediately.
 */
export function isSnoozed(
  latestVersion: string,
  record: DismissRecord | null,
  now: number
): boolean {
  if (!record) return false;
  return record.version === latestVersion && now - record.at < DISMISS_SNOOZE_MS;
}

/** Best-effort read of the persisted dismissal; malformed or missing resolves to null. */
export async function loadDismissRecord(): Promise<DismissRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.version !== 'string' || typeof parsed?.at !== 'number') {
      return null;
    }
    return { version: parsed.version, at: parsed.at };
  } catch {
    return null;
  }
}

/** Best-effort persist of a dismissal; storage failure just means an earlier re-prompt. */
export async function saveDismissRecord(version: string): Promise<void> {
  try {
    const record: DismissRecord = { version, at: Date.now() };
    await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(record));
  } catch {
    // Ignore: the snooze is a courtesy, not a contract.
  }
}

/**
 * Checks config/app for a newer released version of the app.
 *
 * iOS compares the running binary's own version (Application.nativeApplicationVersion,
 * the same number EAS stamps from app.json) against config/app.latestVersion,
 * which is on the same scheme. The App Store's public version name never
 * enters the comparison. Android compares its build number against
 * androidLatestBuild (see the top of this file).
 *
 * Resolves with the latest version + this platform's store URL when the
 * installed build is behind, or null when up to date / not applicable (dev
 * builds, web, missing config, no store URL for this platform, network
 * failure). Never throws - an update nudge is not worth surfacing an error.
 *
 * config/app is world-readable by rule, so this works signed-out too. Fields:
 *   latestVersion       string  iOS: latest released binary version; blank/absent disables the nudge
 *   minVersion          string  iOS: oldest binary still allowed in; older ones get an
 *                               undismissable prompt (blank/absent = no floor)
 *   androidLatestBuild  number  Android: latest released versionCode; absent disables the nudge
 *   androidMinBuild     number  Android: oldest versionCode still allowed in (absent = no floor)
 *   updateMessage  string  what either card says, set per release: what's new
 *                          and a friendly ask (updateMessageEs for Spanish);
 *                          absent = the binary's built-in text
 *   iosUrl         string  App Store listing link
 *   androidUrl     string  Play Store listing link (closed-track testers open it too)
 */
export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  // Dev builds always report the in-progress version and would nag constantly.
  if (__DEV__) return null;

  // The web app deploys with the backend and is always current.
  if (Platform.OS === 'web') return null;

  try {
    const snap = await getDoc(doc(db, 'config', 'app'));
    if (!snap.exists()) return null;
    const data = snap.data();

    const storeUrl = Platform.OS === 'ios' ? data?.iosUrl : data?.androidUrl;
    if (typeof storeUrl !== 'string' || !storeUrl) return null;

    const latestVersion = behindDial(data, 'latest');
    if (!latestVersion) return null;
    const required = !!behindDial(data, 'min');
    const en = typeof data?.updateMessage === 'string' ? data.updateMessage.trim() : '';
    const es = typeof data?.updateMessageEs === 'string' ? data.updateMessageEs.trim() : '';
    return { latestVersion, storeUrl, required, ...(en ? { message: { en, es: es || undefined } } : {}) };
  } catch {
    return null;
  }
}
