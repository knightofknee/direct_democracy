import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  OAuthProvider,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { auth, db } from '@/lib/firebase';
import { randomDisplayName } from '@/lib/names';
import { notifyError } from '@/lib/notify';
import type { UserProfile } from '@/lib/types';

/** Where the device remembers which address a sign-in link was sent to. */
const EMAIL_LINK_KEY = 'dd:emailForSignIn';
const BUNDLE_ID = 'com.briancarlisle.directdemocracy';

interface AuthContextValue {
  /** Firebase auth user; null when signed out. */
  user: User | null;
  /** Firestore profile; null while loading or signed out. */
  profile: UserProfile | null;
  /**
   * True until the signed-in/signed-out question is actually answered: the
   * initial auth restore AND, when a user is present, the first profile
   * snapshot. Screens must not render signed-out UI (sign-in buttons) while
   * this is true - show a skeleton instead.
   */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  /** Passwordless: emails a one-tap sign-in link. Completion is handled by the provider. */
  sendMagicLink: (email: string) => Promise<void>;
  /** Google SSO. On web this opens the provider popup directly. */
  signInWithGoogle: () => Promise<void>;
  /** Apple SSO. Web popup; native uses expo-apple-authentication (iOS only). */
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** The only profile shape self-registration rules accept. */
function newProfileDoc() {
  return {
    displayName: randomDisplayName(),
    role: 'citizen' as const,
    verified: false,
    wardId: null,
    stats: { concerns: 0, comments: 0, votes: 0, judgments: 0 },
    createdAt: serverTimestamp(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  // True once the profile listener has reported for the current user - the
  // doc arrived, or it errored and we give up rather than spin forever.
  const [profileSettled, setProfileSettled] = useState(false);
  const creatingProfileFor = useRef<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthResolved(true);
      if (!u) setProfile(null);
    });
  }, []);

  // Complete email-link (passwordless) sign-in when the app is opened via a
  // sign-in link - the URL arrives as location.href on web and as a deep
  // link on native (universal links / app links must point at the app).
  useEffect(() => {
    const complete = async (url: string | null) => {
      if (!url || !isSignInWithEmailLink(auth, url)) return;
      let email = await AsyncStorage.getItem(EMAIL_LINK_KEY);
      if (!email && Platform.OS === 'web') {
        // Link opened on a different device than the one that requested it.
        email = window.prompt('Confirm your email address to finish signing in');
      }
      if (!email) return;
      try {
        await signInWithEmailLink(auth, email.trim(), url);
        await AsyncStorage.removeItem(EMAIL_LINK_KEY);
        if (Platform.OS === 'web') {
          // Scrub the one-time code out of the address bar and history.
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch (e) {
        notifyError('Sign-in link failed', e);
      }
    };

    if (Platform.OS === 'web') {
      void complete(window.location.href);
      return;
    }
    Linking.getInitialURL().then(complete);
    const sub = Linking.addEventListener('url', (e) => void complete(e.url));
    return () => sub.remove();
  }, []);

  // Whatever the sign-in method (email, Google, Apple), a missing profile is
  // created on first sight - one registration path, enforced by the same
  // self-registration security rules.
  useEffect(() => {
    setProfileSettled(false);
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
          setProfileSettled(true);
        } else if (creatingProfileFor.current !== user.uid) {
          // Doc missing on first sign-in: still loading while we create it;
          // the snapshot refires once the write lands. If the write is
          // rejected, settle anyway so the app is not stuck loading.
          creatingProfileFor.current = user.uid;
          setDoc(ref, newProfileDoc()).catch(() => {
            creatingProfileFor.current = null;
            setProfileSettled(true);
          });
        }
      },
      (err) => {
        console.warn('Profile listener error:', err.message);
        setProfileSettled(true);
      }
    );
  }, [user]);

  const loading = !authResolved || (user != null && !profileSettled);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      signUp: async (email, password) => {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        // Profile doc is created by the listener above.
      },
      sendMagicLink: async (email) => {
        // The continue URL must be on an authorized domain (Firebase console →
        // Authentication → Settings). On phones the emailed link opens the
        // app via universal links; the continue URL is only where the link
        // lands when the app is NOT installed, so it points at the public
        // app page rather than a web app we do not have.
        const continueUrl =
          Platform.OS === 'web'
            ? `${window.location.origin}/sign-in`
            : (process.env.EXPO_PUBLIC_AUTH_CONTINUE_URL ??
              'https://www.waldgrave.com/directdemocracy');
        await sendSignInLinkToEmail(auth, email.trim(), {
          url: continueUrl,
          handleCodeInApp: true,
          iOS: { bundleId: BUNDLE_ID },
          android: { packageName: BUNDLE_ID, installApp: true },
          ...(process.env.EXPO_PUBLIC_AUTH_LINK_DOMAIN
            ? { linkDomain: process.env.EXPO_PUBLIC_AUTH_LINK_DOMAIN }
            : {}),
        });
        await AsyncStorage.setItem(EMAIL_LINK_KEY, email.trim());
      },
      signInWithGoogle: async () => {
        if (Platform.OS === 'web') {
          await signInWithPopup(auth, new GoogleAuthProvider());
          return;
        }
        // Native: the provider-supplied library (Expo's recommendation for
        // SDK 57 - expo-auth-session's Google provider is deprecated).
        // Requires a development build and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.
        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        if (!webClientId) {
          throw new Error(
            'Google sign-in is not configured for this build yet - set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.'
          );
        }
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
        GoogleSignin.configure({ webClientId });
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const result = await GoogleSignin.signIn();
        const idToken = result.data?.idToken;
        if (!idToken) throw new Error('Google sign-in was cancelled.');
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      },
      signInWithApple: async () => {
        if (Platform.OS === 'web') {
          await signInWithPopup(auth, new OAuthProvider('apple.com'));
          return;
        }
        if (Platform.OS !== 'ios') {
          throw new Error('Apple sign-in is available on iOS and the web.');
        }
        const AppleAuthentication = await import('expo-apple-authentication');
        const Crypto = await import('expo-crypto');
        const rawNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
        const hashedNonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce
        );
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        });
        if (!credential.identityToken) throw new Error('Apple sign-in was cancelled.');
        await signInWithCredential(
          auth,
          new OAuthProvider('apple.com').credential({
            idToken: credential.identityToken,
            rawNonce,
          })
        );
      },
      signOut: async () => {
        await firebaseSignOut(auth);
      },
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
