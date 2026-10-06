import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { parseSupabaseEnv } from '@/lib/env';

// EXPO_PUBLIC_ variables are inlined at build time and must be referenced statically.
const env = parseSupabaseEnv({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

// During web static rendering there is no window, so there is nowhere to persist a session.
const canPersistSession = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase = createClient(env.url, env.anonKey, {
  auth: {
    storage: canPersistSession ? AsyncStorage : undefined,
    persistSession: canPersistSession,
    autoRefreshToken: canPersistSession,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export type ConnectionCheck = { ok: true } | { ok: false; message: string };

/**
 * Confirms the configured project is reachable and accepts the anon key.
 * Uses the auth health endpoint so it works before any tables exist.
 */
export async function checkSupabaseConnection(): Promise<ConnectionCheck> {
  try {
    const response = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.anonKey },
    });
    if (!response.ok) {
      return { ok: false, message: `Supabase responded with HTTP ${response.status}.` };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error.';
    return { ok: false, message };
  }
}
