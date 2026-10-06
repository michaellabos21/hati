import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { createDemoClient } from '@/lib/demo/demoClient';
import { parseSupabaseEnv, type SupabaseEnv } from '@/lib/env';

/**
 * Demo mode swaps Supabase for sample data held in memory, so the app can be explored without
 * a backend. It is opt-in, labelled in the UI, and nothing in it is saved.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

function readEnv(): { env: SupabaseEnv | null; error: string | null } {
  try {
    // EXPO_PUBLIC_ variables are inlined at build time and must be referenced statically.
    const env = parseSupabaseEnv({
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });
    return { env, error: null };
  } catch (error) {
    return { env: null, error: error instanceof Error ? error.message : String(error) };
  }
}

const { env, error } = DEMO_MODE ? { env: null, error: null } : readEnv();

/** Why the client could not be created, or null when it is configured. Shown at app start. */
export const supabaseConfigError = error;

// During web static rendering there is no window, so there is nowhere to persist a session.
const canPersistSession = Platform.OS !== 'web' || typeof window !== 'undefined';

const client: SupabaseClient | null = DEMO_MODE
  ? createDemoClient()
  : env
    ? createClient(env.url, env.anonKey, {
        auth: {
          storage: canPersistSession ? AsyncStorage : undefined,
          persistSession: canPersistSession,
          autoRefreshToken: canPersistSession,
          // On web, the email confirmation link lands back on the site with the session in the
          // URL; picking it up signs the new user straight in.
          detectSessionInUrl: Platform.OS === 'web',
        },
      })
    : null;

/** The Supabase client. Throws the configuration error if .env is missing or invalid. */
export function db(): SupabaseClient {
  if (!client) {
    throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  }
  return client;
}

// Only refresh tokens while the app is in the foreground.
if (client && !DEMO_MODE && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      client.auth.startAutoRefresh();
    } else {
      client.auth.stopAutoRefresh();
    }
  });
}

export type ConnectionCheck = { ok: true } | { ok: false; message: string };

/**
 * Confirms the configured project is reachable and accepts the anon key.
 * Uses the auth health endpoint so it works before any tables exist.
 */
export async function checkSupabaseConnection(): Promise<ConnectionCheck> {
  if (!env) {
    const message = DEMO_MODE ? 'Demo mode is on; Supabase is not used.' : supabaseConfigError;
    return { ok: false, message: message ?? 'Supabase is not configured.' };
  }
  try {
    const response = await fetch(`${env.url}/auth/v1/health`, {
      headers: { apikey: env.anonKey },
    });
    if (!response.ok) {
      return { ok: false, message: `Supabase responded with HTTP ${response.status}.` };
    }
    return { ok: true };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unknown network error.';
    return { ok: false, message };
  }
}
