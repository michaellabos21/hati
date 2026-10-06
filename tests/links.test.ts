import { newPasswordSchema } from '@/features/auth/schemas';
import {
  buildInviteMessage,
  buildInviteUrl,
  daysLeft,
  isInviteToken,
} from '@/features/invites/links';
import { toMessage } from '@/lib/errors';

jest.mock('@/lib/supabase', () => ({ db: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const TOKEN = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

describe('invite link helpers', () => {
  it('accepts only uuid tokens', () => {
    expect(isInviteToken(TOKEN)).toBe(true);
    expect(isInviteToken(TOKEN.toUpperCase())).toBe(true);
    for (const bad of ['', 'abc', `${TOKEN}x`, `${TOKEN}/../admin`, undefined, null, 42, [TOKEN]]) {
      expect(isInviteToken(bad)).toBe(false);
    }
  });

  it('builds the join URL without doubling slashes', () => {
    expect(buildInviteUrl('https://hati.example', TOKEN)).toBe(
      `https://hati.example/join/${TOKEN}`,
    );
    expect(buildInviteUrl('https://hati.example/', TOKEN)).toBe(
      `https://hati.example/join/${TOKEN}`,
    );
  });

  it('writes a shareable message with the group name and the link', () => {
    const url = buildInviteUrl('https://hati.example', TOKEN);
    const message = buildInviteMessage(' Boracay 2026 ', url);
    expect(message).toContain('“Boracay 2026”');
    expect(message.endsWith(url)).toBe(true);
  });

  it('counts whole days left, never below zero', () => {
    const now = new Date('2026-10-07T00:00:00Z');
    expect(daysLeft('2026-10-14T00:00:00Z', now)).toBe(7);
    expect(daysLeft('2026-10-07T01:00:00Z', now)).toBe(1);
    expect(daysLeft('2026-10-01T00:00:00Z', now)).toBe(0);
  });
});

describe('new password form', () => {
  it('needs 8+ characters, typed the same twice', () => {
    expect(
      newPasswordSchema.safeParse({ password: 'password1', confirm: 'password1' }).success,
    ).toBe(true);
    const short = newPasswordSchema.safeParse({ password: 'short', confirm: 'short' });
    expect(short.success).toBe(false);
    const mismatch = newPasswordSchema.safeParse({ password: 'password1', confirm: 'password2' });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0].path).toEqual(['confirm']);
  });

  it('explains reset-related errors', () => {
    expect(toMessage({ message: 'Auth session missing!' })).toMatch(/reset link has expired/);
    expect(
      toMessage({ message: 'New password should be different from the old password.' }),
    ).toMatch(/not used before/);
  });
});
