import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button, Field } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp(email, password);
      // Deep links can land here with no history to pop.
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      Alert.alert(
        mode === 'signIn' ? 'Sign in failed' : 'Sign up failed',
        e instanceof Error ? friendlyAuthError(e.message) : 'Something went wrong.'
      );
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        {mode === 'signIn'
          ? 'Welcome back.'
          : 'Create an account to vote and speak up. You’ll get a random display name — change it any time.'}
      </ThemedText>
      <Field
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Password"
        placeholder={mode === 'signUp' ? 'At least 6 characters' : 'Your password'}
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
      <View style={{ alignItems: 'center', gap: Spacing.one }}>
        <Button
          title={mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
          variant="ghost"
          onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        />
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
