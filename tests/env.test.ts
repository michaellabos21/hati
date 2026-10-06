import { EnvError, isPrivilegedKey, parseSupabaseEnv } from '@/lib/env';

const jwt = (payload: object) => `header.${btoa(JSON.stringify(payload))}.signature`;

const ANON_KEY = jwt({ role: 'anon' });
const SERVICE_KEY = jwt({ role: 'service_role' });
const URL_OK = 'https://abc.supabase.co';

describe('parseSupabaseEnv', () => {
  it('accepts an https URL with an anon key', () => {
    expect(parseSupabaseEnv({ url: URL_OK, anonKey: ANON_KEY })).toEqual({
      url: URL_OK,
      anonKey: ANON_KEY,
    });
  });

  it('trims whitespace and trailing slashes', () => {
    const env = parseSupabaseEnv({ url: ` ${URL_OK}/ `, anonKey: ` ${ANON_KEY} ` });
    expect(env).toEqual({ url: URL_OK, anonKey: ANON_KEY });
  });

  it('accepts a publishable key', () => {
    expect(parseSupabaseEnv({ url: URL_OK, anonKey: 'sb_publishable_abc' }).anonKey).toBe(
      'sb_publishable_abc',
    );
  });

  it.each([
    { url: undefined, anonKey: ANON_KEY },
    { url: URL_OK, anonKey: undefined },
    { url: '', anonKey: '' },
  ])('rejects missing settings %#', (raw) => {
    expect(() => parseSupabaseEnv(raw)).toThrow(EnvError);
  });

  it('rejects a malformed URL', () => {
    expect(() => parseSupabaseEnv({ url: 'not a url', anonKey: ANON_KEY })).toThrow(/valid URL/);
  });

  it('rejects plain http for remote hosts but allows it for localhost', () => {
    expect(() => parseSupabaseEnv({ url: 'http://abc.supabase.co', anonKey: ANON_KEY })).toThrow(
      /https/,
    );
    expect(parseSupabaseEnv({ url: 'http://localhost:54321', anonKey: ANON_KEY }).url).toBe(
      'http://localhost:54321',
    );
  });

  it('rejects service_role and secret keys', () => {
    expect(() => parseSupabaseEnv({ url: URL_OK, anonKey: SERVICE_KEY })).toThrow(/service_role/);
    expect(() => parseSupabaseEnv({ url: URL_OK, anonKey: 'sb_secret_abc' })).toThrow(EnvError);
  });
});

describe('isPrivilegedKey', () => {
  it('flags only keys that bypass RLS', () => {
    expect(isPrivilegedKey(SERVICE_KEY)).toBe(true);
    expect(isPrivilegedKey('sb_secret_abc')).toBe(true);
    expect(isPrivilegedKey(ANON_KEY)).toBe(false);
    expect(isPrivilegedKey('not-a-jwt')).toBe(false);
  });
});
