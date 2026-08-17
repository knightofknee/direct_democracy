import { getApps, initializeApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  connectAuthEmulator,
  getAuth,
  // @ts-expect-error - getReactNativePersistence is missing from the SDK's public types on some versions
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Firebase config. This app uses the Firebase **web (JS) SDK** - the same
 * config a web app would use - on iOS, Android, and web alike. The
 * GoogleService-Info.plist in the repo root is read by the NATIVE Firebase
 * module (@react-native-firebase, used only for App Check attestation) and
 * by Google Sign-In.
 *
 * This is the live config for direct-democracy-e338a (Firebase web API keys
 * are identifiers, not secrets - access control lives in firestore.rules).
 *
 * For local development against fake Chicago data, force the Emulator Suite:
 *   npm run emulators                              (in one terminal)
 *   npm run seed                                   (once, to load seed data)
 *   EXPO_PUBLIC_USE_EMULATORS=1 npx expo start     (in another)
 */
const firebaseConfig = {
  apiKey: 'AIzaSyAfW0lqln0MMWw8DNHOElO5lB7ASRfqMBA',
  authDomain: 'direct-democracy-e338a.firebaseapp.com',
  projectId: 'direct-democracy-e338a',
  storageBucket: 'direct-democracy-e338a.firebasestorage.app',
  messagingSenderId: '376113063983',
  appId: '1:376113063983:web:7b39ca781447e0444d7eda',
};

/**
 * Emulators are used while the demo placeholder is in place, or when
 * explicitly forced (handy for local dev after going live):
 *   EXPO_PUBLIC_USE_EMULATORS=1 npx expo start
 */
export const usingEmulators =
  process.env.EXPO_PUBLIC_USE_EMULATORS === '1' || firebaseConfig.projectId.startsWith('demo-');

const app = getApps()[0] ?? initializeApp(firebaseConfig);

export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

export const db = getFirestore(app);
export const functions = getFunctions(app);

/**
 * App Check - proves requests come from the real app, not a bot script with
 * the (public) config above. This is the backbone of abuse resistance:
 * with console-side enforcement ON, unattested Firestore/Functions calls are
 * rejected before rules even run.
 *
 * Web attests via reCAPTCHA v3: create a key at
 * https://console.firebase.google.com → App Check, then set
 * EXPO_PUBLIC_RECAPTCHA_V3_SITE_KEY. Native builds attest via Play
 * Integrity / DeviceCheck, which the Firebase *web* SDK can't provide - wire
 * @react-native-firebase/app-check in the dev-build config before flipping
 * enforcement, or native clients will be locked out.
 */
const recaptchaKey = process.env.EXPO_PUBLIC_RECAPTCHA_V3_SITE_KEY;
if (!usingEmulators && Platform.OS === 'web' && recaptchaKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// Native attestation: the native module (App Attest / Play Integrity) mints
// the tokens, and a CustomProvider hands them to this web SDK so Firestore
// and Functions calls carry them. Fails soft: until the apps are registered
// in Firebase console -> App Check, tokens just don't attach, and nothing
// breaks while enforcement is off.
//
// Registration must be SYNCHRONOUS, in this module's evaluation, before any
// screen subscribes to Firestore: with console-side enforcement ON, a
// listener that fires before App Check is registered goes out unattested,
// gets permission-denied, and never recovers - the cold-start "big board is
// empty" bug. Only the token getter is async; Firestore awaits it per
// request, so the first queries now wait for attestation instead of racing it.
if (!usingEmulators && Platform.OS !== 'web') {
  const nativeAppCheck = (async () => {
    const rnfbApp = await import('@react-native-firebase/app');
    const rnfbAppCheck = await import('@react-native-firebase/app-check');
    // Dev builds can't do real attestation, so they present a fixed debug
    // token (EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN in the gitignored .env.local)
    // that's allowlisted once in Firebase console -> App Check -> Manage
    // debug tokens. No log fishing.
    const debugToken = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
    const provider = new rnfbAppCheck.ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      apple: {
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
        ...(debugToken ? { debugToken } : {}),
      },
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
        ...(debugToken ? { debugToken } : {}),
      },
    });
    const instance = await rnfbAppCheck.initializeAppCheck(rnfbApp.getApp(), {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
    return { rnfbAppCheck, instance };
  })();
  // Surface init failures once; each getToken call still rejects (and the
  // SDK then proceeds unattested), preserving the fail-soft behavior.
  nativeAppCheck.catch((e) => console.warn('App Check native attestation not active yet:', e));

  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => {
        const { rnfbAppCheck, instance } = await nativeAppCheck;
        const { token } = await rnfbAppCheck.getToken(instance, false);
        return { token, expireTimeMillis: Date.now() + 30 * 60 * 1000 };
      },
    }),
    isTokenAutoRefreshEnabled: true,
  });
}

if (usingEmulators) {
  // Physical devices can't reach "localhost" on your dev machine; use the
  // LAN address Expo already knows. Simulators/emulators are fine either way
  // (Android emulator loopback is translated by the hostUri too).
  const devHost =
    Platform.OS === 'web'
      ? 'localhost'
      : (Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost');

  connectAuthEmulator(auth, `http://${devHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, devHost, 8080);
  connectFunctionsEmulator(functions, devHost, 5001);
}
