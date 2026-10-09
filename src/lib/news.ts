import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { useLiveQuery } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';
import { tr } from '@/lib/i18n';
import { notifyError } from '@/lib/notify';
import { useOptimistic } from '@/lib/optimistic';
import type { NewsItem, NewsPrefs, NewsSource } from '@/lib/types';

/**
 * The news tab (2026-10-07): headlines from every newsroom that covers
 * Chicago or Illinois government and publishes a public feed
 * (functions/src/news.ts), newest first, never ranked. Each person turns
 * sources and story languages off for themselves; signed in, the choice is
 * kept on the account (users/{uid}.newsPrefs), signed out on this device.
 */

/** Story languages, each named in its own language like the language picker. */
export const NEWS_LANGS: { code: NewsItem['lang']; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'zh', label: '中文' },
];

const DEVICE_KEY = 'news.prefs';

/** Every source, included ones first in the server's order, then the ones not in. */
export function useNewsSources(): { sources: NewsSource[]; loading: boolean } {
  const { data, loading } = useLiveQuery<NewsSource>(
    () => query(collection(db, 'newsSources'), orderBy('order', 'asc')),
    []
  );
  return { sources: data, loading };
}

/**
 * This person's news choices. Changes show at once (assume success); a
 * failed save rolls back and says so.
 */
export function useNewsPrefs(): {
  hiddenSources: Set<string>;
  hiddenLangs: Set<string>;
  setSourceShown: (id: string, shown: boolean) => void;
  setLangShown: (lang: string, shown: boolean) => void;
  showEverything: () => void;
} {
  const { profile } = useAuth();
  const [device, setDevice] = useState<NewsPrefs>({});
  useEffect(() => {
    if (profile) return;
    let live = true;
    AsyncStorage.getItem(DEVICE_KEY)
      .then((raw) => {
        if (live && raw) setDevice(JSON.parse(raw) as NewsPrefs);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [profile]);

  const server = profile ? (profile.newsPrefs ?? {}) : device;
  const { value: prefs, predict, rollback } = useOptimistic<NewsPrefs>(server);

  const save = (next: NewsPrefs) => {
    if (!profile) {
      setDevice(next);
      AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(next)).catch(() => {});
      return;
    }
    predict(next);
    updateDoc(doc(db, 'users', profile.uid), { newsPrefs: next }).catch((e) => {
      rollback();
      notifyError(tr('Could not save your news choices'), e);
    });
  };
  const toggled = (list: string[] | undefined, id: string, shown: boolean) => {
    const set = new Set(list ?? []);
    if (shown) set.delete(id);
    else set.add(id);
    return [...set];
  };

  return {
    hiddenSources: new Set(prefs.hiddenSources ?? []),
    hiddenLangs: new Set(prefs.hiddenLangs ?? []),
    setSourceShown: (id, shown) =>
      save({ ...prefs, hiddenSources: toggled(prefs.hiddenSources, id, shown) }),
    setLangShown: (lang, shown) => save({ ...prefs, hiddenLangs: toggled(prefs.hiddenLangs, lang, shown) }),
    showEverything: () => save({ hiddenSources: [], hiddenLangs: [] }),
  };
}

/** The stories this person's choices leave in. */
export function visibleNews(items: NewsItem[], hiddenSources: Set<string>, hiddenLangs: Set<string>): NewsItem[] {
  return items.filter((n) => !hiddenSources.has(n.sourceId) && !hiddenLangs.has(n.lang));
}
