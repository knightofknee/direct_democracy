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
 * Paste your Firebase web app config here once the project exists
 * (Firebase console → Project settings → Your apps → Web app).
 * With the placeholder left in place, the app expects the Emulator Suite:
 *   npm run emulators   (in one terminal)
 *   npm run seed        (once, to load Chicago seed data)
 *   npx expo start      (in another)
 */
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-direct-democracy.firebaseapp.com',
  projectId: 'demo-direct-democracy',
  storageBucket: 'demo-direct-democracy.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:demo',
};

/** True until a real config is pasted above — drives emulator connection. */
export const usingEmulators = firebaseConfig.projectId.startsWith('demo-');

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
