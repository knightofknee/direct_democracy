import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { auth, db } from '@/lib/firebase';
import { randomDisplayName } from '@/lib/names';
import type { UserProfile } from '@/lib/types';

interface AuthContextValue {
  /** Firebase auth user; null when signed out. */
  user: User | null;
  /** Firestore profile; null while loading or signed out. */
  profile: UserProfile | null;
  /** True until the initial auth state is known. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) setProfile(null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
    });
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      signUp: async (email, password) => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const newProfile = {
          displayName: randomDisplayName(),
          role: 'citizen' as const,
          verified: false,
          wardId: null,
          registeredVoter: false,
          stats: { concerns: 0, comments: 0, votes: 0, judgments: 0 },
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', cred.user.uid), newProfile);
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
