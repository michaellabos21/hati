import { loginSchema, profileFormSchema, signupSchema } from '@/features/auth/schemas';
import { groupFormSchema } from '@/features/groups/api';
import { parseLedger } from '@/features/ledger/schema';

// The groups module imports the Supabase client; these tests only use its form schema.
jest.mock('@/lib/supabase', () => ({ db: jest.fn() }));

describe('auth schemas', () => {
  it('normalises email and requires a password', () => {
    expect(loginSchema.parse({ email: '  Juan@Email.COM ', password: 'x' }).email).toBe(
      'juan@email.com',
    );
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('requires a name and an 8+ character password to sign up', () => {
    const base = { displayName: 'Michael', email: 'm@x.co', password: 'password1' };
    expect(signupSchema.safeParse(base).success).toBe(true);
    expect(signupSchema.safeParse({ ...base, displayName: '   ' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, displayName: 'x'.repeat(61) }).success).toBe(false);
  });

  it('accepts Philippine mobile numbers, with spaces or dashes, or blank', () => {
    const parse = (gcashNumber: string) =>
      profileFormSchema.safeParse({ displayName: 'M', gcashNumber, mayaNumber: '' });
    expect(parse('0917 123 4567').data?.gcashNumber).toBe('09171234567');
    expect(parse('+63917-123-4567').data?.gcashNumber).toBe('+639171234567');
    expect(parse('').success).toBe(true);
    expect(parse('12345').success).toBe(false);
    expect(parse('0917123456').success).toBe(false);
    expect(parse('08171234567').success).toBe(false);
  });
});

describe('group form schema', () => {
  it('trims and bounds the name and description', () => {
    expect(groupFormSchema.parse({ name: '  Barkada ', description: '' }).name).toBe('Barkada');
    expect(groupFormSchema.safeParse({ name: ' ', description: '' }).success).toBe(false);
    expect(groupFormSchema.safeParse({ name: 'x'.repeat(81), description: '' }).success).toBe(
      false,
    );
  });
});

describe('parseLedger', () => {
  const raw = {
    groups: [
      {
        id: 'g1',
        name: 'Barkada',
        description: null,
        created_by: 'u1',
        created_at: '2026-10-01T00:00:00Z',
        group_members: [
          {
            user_id: 'u2',
            profiles: { id: 'u2', display_name: 'Juan' },
          },
          {
            user_id: 'u1',
            profiles: { id: 'u1', display_name: 'Ana' },
          },
          // A profile hidden by row level security.
          { user_id: 'u3', profiles: null },
        ],
      },
    ],
    expenses: [
      {
        id: 'e1',
        group_id: 'g1',
        description: 'Dinner',
        amount: 1250.5,
        paid_by: 'u1',
        created_by: 'u1',
        split_method: 'equal',
        created_at: '2026-10-02T00:00:00Z',
        expense_splits: [
          { user_id: 'u1', amount_owed: '625.25' },
          { user_id: 'u2', amount_owed: 625.25 },
        ],
      },
    ],
    settlements: [
      {
        id: 's1',
        group_id: 'g1',
        from_user: 'u2',
        to_user: 'u1',
        amount: 0.29,
        created_by: 'u2',
        created_at: '2026-10-03T00:00:00Z',
      },
    ],
  };

  it('converts rows to app shapes with money in centavos', () => {
    const ledger = parseLedger(raw);
    expect(ledger.expenses[0]).toMatchObject({
      groupId: 'g1',
      amount: 125050,
      paidBy: 'u1',
      splits: [
        { userId: 'u1', amount: 62525 },
        { userId: 'u2', amount: 62525 },
      ],
    });
    expect(ledger.settlements[0]).toMatchObject({ from: 'u2', to: 'u1', amount: 29 });
  });

  it('sorts members by name and labels hidden profiles', () => {
    const { members } = parseLedger(raw).groups[0];
    expect(members.map((m) => m.displayName)).toEqual(['Ana', 'Former member', 'Juan']);
  });

  it('rejects rows that do not match the expected shape', () => {
    expect(() =>
      parseLedger({ ...raw, expenses: [{ ...raw.expenses[0], split_method: 'percent' }] }),
    ).toThrow();
    expect(() => parseLedger({ ...raw, settlements: [{ id: 's1' }] })).toThrow();
  });
});
