import { getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  // @ts-expect-error — getReactNativePersistence is missing from the SDK's public types on some versions
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Firebase config. This app uses the Firebase **web (JS) SDK** — the same
 * config a web app would use — on iOS, Android, and web alike. The
 * GoogleService-Info.plist in the repo root is NOT read by this SDK; it's
 * only there for a future move to the native react-native-firebase SDK.
 *
 * This is the live config for direct-democracy-e338a (Firebase web API keys
 * are identifiers, not secrets — access control lives in firestore.rules).
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
