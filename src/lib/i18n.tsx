import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ES } from '@/i18n/es';
import { HI } from '@/i18n/hi';
import { KO } from '@/i18n/ko';
import { PL } from '@/i18n/pl';
import { TL } from '@/i18n/tl';
import { ZH } from '@/i18n/zh';

/**
 * Languages, one setting. Strings are keyed by their English source text
 * (`t('Register')`), looked up in the chosen language's dictionary and
 * returned unchanged when it has no entry, so an untranslated string is
 * never blank, it is English. The choice lives on the device (AsyncStorage)
 * and is asked exactly once on first launch; after that it lives in
 * Settings. Candidate statements are never machine-translated: what a
 * candidate said stays in the words they said it.
 *
 * Spanish is the full set (UI, seeded data, notifications). Chinese
 * (Simplified), Polish, Tagalog, Korean, and Hindi (2026-09-29, the Board of
 * Elections' ballot languages) cover the app's own text; seeded data and
 * server notifications fall back to English for them.
 */
export type Locale = 'en' | 'es' | 'zh' | 'pl' | 'tl' | 'ko' | 'hi';

/** Every language, named in itself, in the order they're offered. */
export const LANGUAGES: { code: Locale; name: string; dateLocale: string }[] = [
  { code: 'en', name: 'English', dateLocale: 'en-US' },
  { code: 'es', name: 'Español', dateLocale: 'es-MX' },
  { code: 'zh', name: '中文', dateLocale: 'zh-CN' },
  { code: 'pl', name: 'Polski', dateLocale: 'pl-PL' },
  { code: 'tl', name: 'Tagalog', dateLocale: 'fil-PH' },
  { code: 'ko', name: '한국어', dateLocale: 'ko-KR' },
  { code: 'hi', name: 'हिन्दी', dateLocale: 'hi-IN' },
];

const DICTS: Record<Exclude<Locale, 'en'>, Record<string, string>> = {
  es: ES,
  zh: ZH,
  pl: PL,
  tl: TL,
  ko: KO,
  hi: HI,
};

function lookup(locale: Locale, source: string): string {
  return locale === 'en' ? source : (DICTS[locale][source] ?? source);
}

/** The locale tag for formatting dates and numbers in the app's language. */
export function dateLocale(locale: Locale = activeLocale): string {
  return LANGUAGES.find((l) => l.code === locale)?.dateLocale ?? 'en-US';
}

function isLocale(v: string | null): v is Locale {
  return LANGUAGES.some((l) => l.code === v);
}

const LOCALE_KEY = 'locale';
const PROMPTED_KEY = 'locale.prompted';

// Mirror of the active locale for code that runs outside React (time
// formatting, notify fallbacks). The provider keeps it in sync.
let activeLocale: Locale = 'en';

export function getLocale(): Locale {
  return activeLocale;
}

/** Non-hook `t` for code outside components (formatters, notify). */
export function tr(source: string): string {
  return lookup(activeLocale, source);
}

interface LocaleState {
  locale: Locale;
  /** Null until storage has been read; the prompt waits for it. */
  ready: boolean;
  prompted: boolean;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleState>({
  locale: 'en',
  ready: false,
  prompted: true,
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [prompted, setPrompted] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(LOCALE_KEY), AsyncStorage.getItem(PROMPTED_KEY)])
      .then(([saved, wasPrompted]) => {
        if (isLocale(saved)) {
          activeLocale = saved;
          setLocaleState(saved);
        }
        setPrompted(wasPrompted === '1');
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setLocale = useCallback((next: Locale) => {
    activeLocale = next;
    setLocaleState(next);
    setPrompted(true);
    AsyncStorage.multiSet([
      [LOCALE_KEY, next],
      [PROMPTED_KEY, '1'],
    ]).catch(() => {});
  }, []);

  const value = useMemo(() => ({ locale, ready, prompted, setLocale }), [locale, ready, prompted, setLocale]);
  // Nothing draws until the saved language is known (the splash screen
  // covers these few milliseconds). The React Compiler caches render-time
  // calls like wardLabel() and plural() by their arguments alone, so a first
  // pass in English would leave English behind in every other language.
  return <LocaleContext.Provider value={value}>{ready ? children : null}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  return useContext(LocaleContext);
}

/** `t('English source')` in the app's language, or the source when it has no entry. */
export function useT(): (source: string) => string {
  const { locale } = useLocale();
  return useCallback(
    (source: string) => lookup(locale, source),
    [locale]
  );
}

/**
 * Pick the Spanish rendition of an operator-authored data field when the
 * locale is Spanish and a translation exists; the English is the fallback,
 * so untranslated data reads as English, never blank.
 */
export function useLocalized(): (en: string | null, es?: string | null) => string | null {
  const { locale } = useLocale();
  return useCallback(
    (en: string | null, es?: string | null) => (locale === 'es' && es ? es : en),
    [locale]
  );
}

/**
 * Polish counts take a third form for 2-4 (22-24, 32-34...): "3 głosy",
 * not "3 głosów". The dictionary holds it under "<plural>|few". Written out
 * rather than read from Intl.PluralRules, which Hermes does not ship.
 */
function isFew(locale: Locale, n: number): boolean {
  if (locale !== 'pl') return false;
  const ones = n % 10;
  const tens = n % 100;
  return ones >= 2 && ones <= 4 && !(tens >= 12 && tens <= 14);
}

/** The noun for a count in a language: 'vote' / 'votes', and Polish's 2-4 form. */
export function countNoun(n: number, one: string, many?: string, locale: Locale = activeLocale): string {
  if (n === 1) return lookup(locale, one);
  const key = many ?? `${one}s`;
  const few = locale !== 'en' && isFew(locale, n) ? DICTS[locale][`${key}|few`] : undefined;
  return few ?? lookup(locale, key);
}

/** Count with a noun: `plural(3, 'candidate')` in the app's language. */
export function usePlural(): (n: number, one: string, many?: string) => string {
  const { locale } = useLocale();
  return useCallback(
    (n: number, one: string, many?: string) => `${n} ${countNoun(n, one, many, locale)}`,
    [locale]
  );
}
