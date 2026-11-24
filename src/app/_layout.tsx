import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/components/theme';
import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.accent },
};

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  // Session exists but profile not fetched yet → still loading.
  if (loading || (session && !profile)) return <Loading />;

  const signedIn = !!session;
  const onboarded = !!profile?.onboarded;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="log/[meal]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="food/[id]" />
        <Stack.Screen name="food/new" />
        <Stack.Screen name="quick-add" />
        <Stack.Screen name="targets" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
