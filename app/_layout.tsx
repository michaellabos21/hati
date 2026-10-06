import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { colors, fonts } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { supabaseConfigError } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );

  // Refetch when the app comes back to the foreground, so balances reflect what friends did.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  // If the fonts fail to load the app still works, in the system font.
  const ready = fontsLoaded || fontError !== null;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  if (supabaseConfigError) {
    return (
      <Screen safeTop>
        <EmptyState
          emoji="🔌"
          title="HATI is not connected yet"
          body={`${supabaseConfigError} To look around with sample data instead, set EXPO_PUBLIC_DEMO_MODE=true in .env.`}
        />
      </Screen>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) return <LoadingState label="Opening HATI…" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        headerTitleStyle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.ink },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.paper },
      }}>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="groups/create" options={{ title: 'New group' }} />
        <Stack.Screen name="groups/pick" options={{ title: 'Add expense' }} />
        <Stack.Screen name="groups/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="groups/[id]/add-expense" options={{ title: 'Add expense' }} />
        <Stack.Screen name="groups/[id]/add-member" options={{ title: 'Invite' }} />
        <Stack.Screen name="groups/[id]/balances" options={{ title: 'Balances' }} />
        <Stack.Screen name="groups/[id]/settle" options={{ title: 'Record a payment' }} />
        <Stack.Screen name="groups/[id]/remind" options={{ title: 'Send a reminder' }} />
        <Stack.Screen name="expenses/[id]" options={{ title: 'Expense' }} />
        <Stack.Screen name="premium" options={{ title: '' }} />
      </Stack.Protected>
      <Stack.Protected guard={session === null}>
        <Stack.Screen name="auth/welcome" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: '' }} />
        <Stack.Screen name="auth/signup" options={{ title: '' }} />
      </Stack.Protected>
    </Stack>
  );
}
