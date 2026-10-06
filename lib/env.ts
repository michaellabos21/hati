// Validation for the public Supabase settings. Pure so it can be unit tested
// and reused by scripts/check-supabase.mjs's rules.

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

type RawSupabaseEnv = {
  url: string | undefined;
  anonKey: string | undefined;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function jwtRole(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(base64));
    if (typeof payload === 'object' && payload !== null && 'role' in payload) {
      return typeof payload.role === 'string' ? payload.role : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** A key that bypasses Row Level Security must never ship in the app bundle. */
export function isPrivilegedKey(key: string): boolean {
  return key.startsWith('sb_secret_') || jwtRole(key) === 'service_role';
}

export function parseSupabaseEnv(raw: RawSupabaseEnv): SupabaseEnv {
  const url = raw.url?.trim();
  const anonKey = raw.anonKey?.trim();

  if (!url || !anonKey) {
    throw new EnvError(
      'Missing Supabase settings. Copy .env.example to .env, set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new EnvError('EXPO_PUBLIC_SUPABASE_URL is not a valid URL.');
  }

  const isLocal = LOCAL_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(isLocal && parsed.protocol === 'http:')) {
    throw new EnvError('EXPO_PUBLIC_SUPABASE_URL must use https.');
  }

  if (isPrivilegedKey(anonKey)) {
    throw new EnvError(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY holds a service_role/secret key. That key bypasses Row ' +
        'Level Security and must never be in the app. Use the anon (publishable) key.',
    );
  }

  return { url: url.replace(/\/+$/, ''), anonKey };
}
