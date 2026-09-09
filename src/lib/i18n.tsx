import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ES } from '@/i18n/es';

/**
 * Two languages, one setting. Strings are keyed by their English source text
 * (`t('Register')`), looked up in the Spanish dictionary when the locale is
 * 'es' and returned unchanged otherwise, so an untranslated string is never
 * blank, it is English. The choice lives on the device (AsyncStorage) and is
 * asked exactly once, in both languages, on first launch; after that it
 * lives in Settings. Candidate statements are never machine-translated: what
 * a candidate said stays in the words they said it.
 */
export type Locale = 'en' | 'es';

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
  return activeLocale === 'es' ? (ES[source] ?? source) : source;
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
        if (saved === 'es' || saved === 'en') {
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
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleState {
  return useContext(LocaleContext);
}

/** `t('English source')` → Spanish when the locale is 'es', else the source. */
export function useT(): (source: string) => string {
  const { locale } = useLocale();
  return useCallback(
    (source: string) => (locale === 'es' ? (ES[source] ?? source) : source),
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

/** Count with a noun: `plural(3, 'candidate')` in either language. */
export function usePlural(): (n: number, one: string, many?: string) => string {
  const t = useT();
  return useCallback(
    (n: number, one: string, many?: string) => `${n} ${t(n === 1 ? one : (many ?? `${one}s`))}`,
    [t]
  );
}
