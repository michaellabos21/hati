import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.primaryDark,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ title: 'Log in' }} />
        <Stack.Screen name="auth/signup" options={{ title: 'Sign up' }} />
        <Stack.Screen name="groups/create" options={{ title: 'New group' }} />
        <Stack.Screen name="groups/[id]/index" options={{ title: 'Group' }} />
        <Stack.Screen name="groups/[id]/add-expense" options={{ title: 'Add expense' }} />
        <Stack.Screen name="groups/[id]/settle" options={{ title: 'Settle up' }} />
        <Stack.Screen name="expenses/[id]" options={{ title: 'Expense' }} />
      </Stack>
    </>
  );
}
