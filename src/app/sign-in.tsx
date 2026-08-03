import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { auth } from '@/lib/firebase';
import { notify } from '@/lib/notify';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle, signInWithApple, sendMagicLink } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const done = () => {
    // Deep links can land here with no history to pop.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp(email, password);
      done();
    } catch (e) {
      notify(
        mode === 'signIn' ? 'Sign in failed' : 'Sign up failed',
        e instanceof Error ? friendlyAuthError(e.message) : 'Something went wrong.'
      );
      setBusy(false);
    }
  };

  const sso = async (provider: 'google' | 'apple') => {
    setBusy(true);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithApple();
      done();
    } catch (e) {
      notify('Sign in failed', e instanceof Error ? friendlyAuthError(e.message) : 'Something went wrong.');
      setBusy(false);
    }
  };

  const requireEmail = () => {
    if (!email.trim()) {
      notify('Enter your email', 'Type your email above first.');
      return false;
    }
    return true;
  };

  return (
    <Screen>
      <Button
        title="Continue with Google"
        variant="secondary"
        icon={<Ionicons name="logo-google" size={16} />}
        onPress={() => sso('google')}
        disabled={busy}
      />
      {(Platform.OS === 'ios' || Platform.OS === 'web') && (
        <Button
          title="Continue with Apple"
          variant="secondary"
          icon={<Ionicons name="logo-apple" size={17} />}
          onPress={() => sso('apple')}
          disabled={busy}
        />
      )}

      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center', fontSize: 12 }}>
        or with email
      </ThemedText>
      <Field
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        placeholder={mode === 'signUp' ? 'Password (at least 6 characters)' : 'Password'}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button
        title={mode === 'signIn' ? 'Sign in' : 'Create account'}
        onPress={submit}
        loading={busy}
        disabled={!email.trim() || password.length < 6}
      />

      <View style={{ alignItems: 'center', gap: 0 }}>
        <Button
          title={mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
          variant="ghost"
          onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        />
        {mode === 'signIn' && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              title="Email me a sign-in link"
              variant="ghost"
              onPress={async () => {
                if (!requireEmail()) return;
                try {
                  await sendMagicLink(email);
                  notify('Link sent', 'Check your email on this device. The link signs you in with no password.');
                } catch (e) {
                  notify(
                    'Could not send the link',
                    e instanceof Error ? friendlyAuthError(e.message) : 'Something went wrong.'
                  );
                }
              }}
            />
            <Button
              title="Forgot password?"
              variant="ghost"
              onPress={async () => {
                if (!requireEmail()) return;
                try {
                  await sendPasswordResetEmail(auth, email.trim());
                  notify('Reset email sent', 'Check your inbox for a link to set a new password.');
                } catch (e) {
                  notify(
                    'Could not send reset email',
                    e instanceof Error ? friendlyAuthError(e.message) : 'Something went wrong.'
                  );
                }
              }}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}

function friendlyAuthError(message: string): string {
  if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password')) {
    return 'Email or password is incorrect.';
  }
  if (message.includes('auth/email-already-in-use')) {
    return 'An account with that email already exists.';
  }
  if (message.includes('auth/invalid-email')) {
    return 'That email address doesn’t look right.';
  }
  if (message.includes('auth/weak-password')) {
    return 'Choose a stronger password (at least 6 characters).';
  }
  return message;
}
