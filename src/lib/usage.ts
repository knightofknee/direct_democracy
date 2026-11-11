import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { useGlobalSearchParams, useSegments } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { db, usingEmulators } from '@/lib/firebase';
import { MAYOR_GAMES } from '@/lib/mayor-games-data';
import { helpKey } from '@/lib/page-help';

/**
 * Anonymous screen counts (2026-10-09): which tabs and screens get opened
 * and which are ignored, for Brian only, never shown in the app. A view is
 * counted per route PATTERN (the help key: '(tabs)/news', 'official/[id]',
 * never an id), held in memory, and sent at most once a minute and when
 * the app goes to the background as ONE `usageEvents` doc: the Chicago
 * day, the platform, the app version, view counts, and `reach` (the routes
 * this device opens for the first time today, which is how the server
 * counts devices per screen without any id). Nothing names a person or a
 * device: no uid, no install id, no token. The onUsageEvent trigger adds
 * it into `usageDaily/{day}` and deletes it.
 *
 * Off in development and against the emulators. Never blocks or throws
 * into the UI: a failed send is dropped.
 */
const ENABLED = !__DEV__ && !usingEmulators;

/** Same shape the rules and the trigger accept. */
const ROUTE_RE = /^[\w()[\]/#-]+$/;
/** The rules cap each map at 40 keys; send before a 41st route. */
const MAX_KEYS = 40;
const FLUSH_MS = 60_000;
const SEEN_KEY = 'usage.seenToday';

let buffer: { day: string; views: Record<string, number> } | null = null;
/** Routes this device already reported reach for today. */
let seen: { day: string; routes: Set<string> } | null = null;
let seenLoaded: Promise<void> | null = null;
let flushing = false;
let lastKey: string | null = null;
/** Navigator redraws (language, text size) bounce through home; not views. */
let quietUntil = 0;

/** 'YYYY-MM-DD' on Chicago's clock. */
function chicagoDay(now = new Date()): string {
  const s = now.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : now.toISOString().slice(0, 10);
}

function platform(): 'ios' | 'android' | 'web' {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
}

function loadSeen(): Promise<void> {
  seenLoaded ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(SEEN_KEY);
      const parsed = raw ? (JSON.parse(raw) as { day?: unknown; routes?: unknown }) : null;
      if (parsed && typeof parsed.day === 'string' && Array.isArray(parsed.routes)) {
        seen = { day: parsed.day, routes: new Set(parsed.routes.filter((r): r is string => typeof r === 'string')) };
      }
    } catch {
      // Unreadable storage: this device just counts as new today.
    }
  })();
  return seenLoaded;
}

/** Send what is buffered. Safe to call any time; never throws. */
async function flush(): Promise<void> {
  if (!ENABLED || flushing || !buffer || Object.keys(buffer.views).length === 0) return;
  flushing = true;
  const batch = buffer;
  buffer = null;
  try {
    await loadSeen();
    if (!seen || seen.day !== batch.day) seen = { day: batch.day, routes: new Set() };
    const reach: Record<string, number> = {};
    for (const route of Object.keys(batch.views)) {
      if (!seen.routes.has(route)) reach[route] = 1;
    }
    await addDoc(collection(db, 'usageEvents'), {
      day: batch.day,
      platform: platform(),
      appVersion: Platform.OS === 'web' ? 'web' : (Application.nativeApplicationVersion ?? 'unknown').slice(0, 20),
      views: batch.views,
      reach,
    });
    for (const route of Object.keys(reach)) seen.routes.add(route);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify({ day: seen.day, routes: [...seen.routes] }));
  } catch {
    // Dropped on purpose: these counts are never worth an error.
  } finally {
    flushing = false;
  }
}

/** Count one view of a route pattern. */
function record(route: string): void {
  if (!ENABLED || !ROUTE_RE.test(route) || route.length > 80) return;
  const day = chicagoDay();
  if (buffer && (buffer.day !== day || (!(route in buffer.views) && Object.keys(buffer.views).length >= MAX_KEYS))) {
    void flush();
  }
  buffer ??= { day, views: {} };
  buffer.views[route] = (buffer.views[route] ?? 0) + 1;
}

let started = false;

/** The minute timer and the background flush, once per app run. */
function start(): void {
  if (started || !ENABLED) return;
  started = true;
  setInterval(() => void flush(), FLUSH_MS);
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') void flush();
  });
}

/**
 * Mount ONCE, above the navigator that redraws. `redrawKey` changes when
 * the navigator is redrawn (language or text size), and the screens it
 * passes through on the way back are not counted as views. State lives at
 * module level, so a remount never counts a screen twice.
 */
export function useUsageTracking(redrawKey: string): void {
  const page = helpKey(useSegments());
  // The five mayor games share one screen. They are counted apart
  // ('game/blind', 'game/lines', ...) so the counts can say which games get
  // played; the kind is one of five fixed words, never an id.
  const { kind } = useGlobalSearchParams<{ kind?: string }>();
  const route = page === 'game/[kind]' && MAYOR_GAMES.some((g) => g.kind === kind) ? `game/${kind}` : page;
  const drawn = useRef(redrawKey);
  useEffect(() => {
    if (drawn.current === redrawKey) return;
    drawn.current = redrawKey;
    quietUntil = Date.now() + 2000;
  }, [redrawKey]);
  useEffect(() => {
    start();
    if (route === lastKey) return;
    lastKey = route;
    if (Date.now() < quietUntil) return;
    record(route);
  }, [route]);
}
