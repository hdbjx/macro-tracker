import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors, space } from '@/components/theme';
import { Button, ErrorText, Field, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.includes('@')) return setError('Enter a valid email.');
    if (password.length < 8) return setError('Password needs at least 8 characters.');
    setBusy(true);
    const { data, error: err } =
      mode === 'up'
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) return setError(err.message);
    if (mode === 'up' && !data.session) setNotice('Check your email to confirm your account, then sign in.');
  }

  return (
    <Screen style={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ marginBottom: space.xxl }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: colors.accent,
            marginBottom: space.xl,
          }}
        />
        <T v="h1">{mode === 'up' ? 'Track what you eat,\nwithout the friction.' : 'Welcome back.'}</T>
        <T color={colors.muted} style={{ marginTop: space.sm }}>
          {mode === 'up' ? 'Create an account to get started.' : 'Sign in to keep logging.'}
        </T>
      </View>

      <View style={{ gap: space.lg }}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@email.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          textContentType={mode === 'up' ? 'newPassword' : 'password'}
          placeholder="8+ characters"
          onSubmitEditing={submit}
        />
      </View>
      <ErrorText>{error}</ErrorText>
      {notice ? <T v="small" color={colors.accent} style={{ marginTop: space.sm }}>{notice}</T> : null}

      <Button title={mode === 'up' ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} style={{ marginTop: space.xl }} />
      <Pressable onPress={() => setMode(mode === 'up' ? 'in' : 'up')} style={{ padding: space.lg, alignItems: 'center' }}>
        <T v="small" color={colors.muted}>
          {mode === 'up' ? 'Already have an account? ' : 'New here? '}
          <T v="small" color={colors.text} style={{ fontWeight: '700' }}>
            {mode === 'up' ? 'Sign in' : 'Create one'}
          </T>
        </T>
      </Pressable>
    </Screen>
  );
}
