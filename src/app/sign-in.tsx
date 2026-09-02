import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleLogo } from '@/components/google-logo';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { auth } from '@/lib/firebase';
import { notify } from '@/lib/notify';

export default function SignInScreen() {
  const router = useRouter();
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { user, signIn, signUp, signInWithGoogle, signInWithApple, sendMagicLink } = useAuth();

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<'google' | 'apple' | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const anyLoading = submitting || ssoLoading != null || sendingEmail;

  // Already signed in with nothing in flight (a restored session, or a
  // magic link that completed while this screen was up): nothing to do here.
  useEffect(() => {
    if (user && !submitting && !ssoLoading) done();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const done = () => {
    // Always land on the big board, wherever sign-in was opened from.
    // Dismiss the modal first - a bare replace() from inside a native modal
    // can pop to whatever screen sat under it instead of the target.
    if (router.canDismiss()) router.dismiss();
    router.replace('/');
  };

  const submit = async () => {
    if (!email.trim() || !password) return;
    Keyboard.dismiss();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp(email, password);
      done();
    } catch (e) {
      setError(e instanceof Error ? friendlyAuthError(e.message) : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  const sso = async (provider: 'google' | 'apple') => {
    Keyboard.dismiss();
    setError('');
    setSsoLoading(provider);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithApple();
      done();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      // Backing out of the provider sheet is not an error to shout about.
      if (!/cancel|popup-closed-by-user/i.test(message)) {
        setError(message ? friendlyAuthError(message) : 'Something went wrong.');
      }
      setSsoLoading(null);
    }
  };

  const requireEmail = () => {
    if (!email.trim()) {
      setError('Type your email above first.');
      return false;
    }
    return true;
  };

  const magicLink = async () => {
    if (!requireEmail()) return;
    setError('');
    setSendingEmail(true);
    try {
      await sendMagicLink(email);
      notify('Link sent', 'Check your email on this device. The link signs you in with no password.');
    } catch (e) {
      setError(e instanceof Error ? friendlyAuthError(e.message) : 'Something went wrong.');
    } finally {
      setSendingEmail(false);
    }
  };

  const forgotPassword = async () => {
    if (!requireEmail()) return;
    setError('');
    setSendingEmail(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      notify('Reset email sent', 'Check your inbox for a link to set a new password.');
    } catch (e) {
      setError(e instanceof Error ? friendlyAuthError(e.message) : 'Something went wrong.');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Decorative soft circles in the flag's sky blue */}
      <View style={[styles.blobA, { backgroundColor: theme.backgroundSelected }]} />
      <View style={[styles.blobB, { backgroundColor: theme.primarySoft }]} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + Spacing.four },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        bounces={false}
        overScrollMode="never">
        <View style={styles.inner}>
          {/* Header / logo */}
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/images/icon.png')}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>
            <ThemedText type="subtitle" style={styles.title}>
              {mode === 'signIn' ? 'Welcome back' : 'Create account'}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {mode === 'signIn'
                ? 'Sign in to direct democracy'
                : 'Get started with direct democracy'}
            </ThemedText>
          </View>

          {/* Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            {/* Toggle mode */}
            <View style={styles.topRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {mode === 'signIn' ? 'New here?' : 'Already have an account?'}
              </ThemedText>
              <Pressable
                onPress={() => {
                  setError('');
                  setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                }}
                hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  {mode === 'signIn' ? 'Create an account' : 'Sign in'}
                </ThemedText>
              </Pressable>
            </View>

            {/* Error (space reserved so the card never jumps) */}
            <ThemedText
              type="small"
              style={[styles.error, { color: theme.danger, opacity: error ? 1 : 0 }]}>
              {error || ' '}
            </ThemedText>

            {/* Email */}
            <View style={styles.inputGroup}>
              <ThemedText type="smallBold">Email</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: emailFocused ? theme.primary : theme.border,
                    backgroundColor: theme.background,
                    color: theme.text,
                  },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                value={email}
                editable={!anyLoading}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <ThemedText type="smallBold">Password</ThemedText>
              <View
                style={[
                  styles.input,
                  styles.inputRow,
                  {
                    borderColor: pwFocused ? theme.primary : theme.border,
                    backgroundColor: theme.background,
                  },
                ]}>
                <TextInput
                  style={{ flex: 1, color: theme.text, padding: 0 }}
                  placeholder={mode === 'signUp' ? 'At least 6 characters' : '••••••••'}
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                  value={password}
                  editable={!anyLoading}
                  onChangeText={setPassword}
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                  textContentType="password"
                  autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {showPassword ? 'Hide' : 'Show'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Submit */}
            <Pressable
              onPress={submit}
              disabled={anyLoading || !email.trim() || !password}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: theme.primary },
                pressed && { opacity: 0.9 },
                (anyLoading || !email.trim() || !password) && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={mode === 'signIn' ? 'Sign in' : 'Create account'}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText type="smallBold" style={styles.primaryBtnText}>
                  Enter
                </ThemedText>
              )}
            </Pressable>

            {/* Passwordless link + password reset, side by side */}
            {mode === 'signIn' && (
              <View style={styles.linkRow}>
                <Pressable onPress={magicLink} disabled={anyLoading} hitSlop={8}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    Email me a sign-in link
                  </ThemedText>
                </Pressable>
                <Pressable onPress={forgotPassword} disabled={anyLoading} hitSlop={8}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    Forgot password?
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {/* SSO divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.dividerText}>
                {mode === 'signIn' ? 'or sign in with' : 'or sign up with'}
              </ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* SSO buttons */}
            <View style={styles.ssoRow}>
              <Pressable
                onPress={() => sso('google')}
                disabled={anyLoading}
                style={({ pressed }) => [
                  styles.ssoBtn,
                  {
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.background,
                  },
                  pressed && { opacity: 0.85 },
                  anyLoading && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google">
                {ssoLoading === 'google' ? (
                  <ActivityIndicator color={theme.text} />
                ) : (
                  <View style={styles.ssoBtnInner}>
                    <GoogleLogo size={22} />
                    <ThemedText type="smallBold">Google</ThemedText>
                  </View>
                )}
              </Pressable>

              {(Platform.OS === 'ios' || Platform.OS === 'web') && (
                <Pressable
                  onPress={() => sso('apple')}
                  disabled={anyLoading}
                  style={({ pressed }) => [
                    styles.ssoBtn,
                    { backgroundColor: isDark ? '#FFFFFF' : '#000000' },
                    pressed && { opacity: 0.85 },
                    anyLoading && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with Apple">
                  {ssoLoading === 'apple' ? (
                    <ActivityIndicator color={isDark ? '#000000' : '#FFFFFF'} />
                  ) : (
                    <View style={styles.ssoBtnInner}>
                      <Ionicons
                        name="logo-apple"
                        size={22}
                        color={isDark ? '#000000' : '#FFFFFF'}
                      />
                      <ThemedText
                        type="smallBold"
                        style={{ color: isDark ? '#000000' : '#FFFFFF' }}>
                        Apple
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              )}
            </View>

            {/* Privacy notice */}
            <View style={styles.privacyRow}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.privacyText}>
                By continuing you agree to our{' '}
              </ThemedText>
              <Pressable onPress={() => router.push('/privacy')} hitSlop={8}>
                <ThemedText type="small" style={[styles.privacyText, { color: theme.primary, fontWeight: '700' }]}>
                  privacy policy
                </ThemedText>
              </Pressable>
              <ThemedText type="small" themeColor="textSecondary" style={styles.privacyText}>
                .
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* SSO loading overlay */}
      {ssoLoading != null && (
        <View
          style={[
            styles.blocker,
            { backgroundColor: isDark ? 'rgba(11,21,32,0.98)' : 'rgba(255,255,255,0.98)' },
          ]}
          pointerEvents="auto">
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
            {ssoLoading === 'google' ? 'Signing in with Google…' : 'Signing in with Apple…'}
          </ThemedText>
        </View>
      )}
    </View>
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
  if (message.includes('auth/too-many-requests')) {
    return 'Too many attempts. Try again later.';
  }
  if (message.includes('auth/network-request-failed')) {
    return 'Network problem. Check your connection and try again.';
  }
  return message;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: Spacing.four,
  },
  inner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoWrapper: {
    width: 84,
    height: 84,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
  },
  logo: {
    width: 84,
    height: 84,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 6,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  error: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  inputGroup: {
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.one,
    marginTop: 10,
    paddingHorizontal: Spacing.one,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.three,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
  },
  ssoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ssoBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  ssoBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  privacyRow: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  privacyText: {
    fontSize: 12,
    lineHeight: 16,
  },
  blobA: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 999,
    top: -70,
    right: -55,
  },
  blobB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    bottom: -50,
    left: -40,
  },
  blocker: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
