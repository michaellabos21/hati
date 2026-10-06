import { expenseEmoji, groupEmoji } from '@/features/groups/emoji';
import { greeting, relativeTime } from '@/lib/dates';
import { toMessage } from '@/lib/errors';

describe('toMessage', () => {
  it.each([
    [new TypeError('Network request failed'), /No connection/],
    [new TypeError('Failed to fetch'), /No connection/],
    [{ message: 'Invalid login credentials' }, /Wrong email or password/],
    [{ message: 'User already registered' }, /already has an account/],
    [{ message: 'Email not confirmed' }, /Confirm your email/],
    [{ message: 'email rate limit exceeded' }, /Too many tries/],
    [
      {
        code: '23505',
        message: 'duplicate key value violates unique constraint "group_members_pkey"',
      },
      /already in this group/,
    ],
    [
      { code: '42501', message: 'new row violates row-level security policy for table "expenses"' },
      /permission/,
    ],
  ])('explains %j', (error, expected) => {
    expect(toMessage(error)).toMatch(expected);
  });

  it('passes through messages the database raises on purpose', () => {
    expect(toMessage({ code: '23514', message: 'Settle up before leaving this group.' })).toBe(
      'Settle up before leaving this group.',
    );
  });

  it('never shows raw database errors', () => {
    const raw = {
      code: '23514',
      message:
        'new row for relation "expenses" violates check constraint "expenses_amount_positive"',
    };
    expect(toMessage(raw)).toBe('Some of those details are not valid.');
    expect(toMessage({ code: 'XX000', message: 'internal error at foo.c:12' })).toMatch(
      /Something went wrong/,
    );
  });

  it('falls back for anything unrecognisable', () => {
    for (const value of [null, undefined, 42, {}, { message: '' }]) {
      expect(toMessage(value)).toMatch(/Something went wrong/);
    }
  });

  it('shows short auth messages as they are', () => {
    expect(toMessage({ message: 'Password should be at least 8 characters.' })).toBe(
      'Password should be at least 8 characters.',
    );
  });
});

describe('relativeTime', () => {
  const now = new Date(2026, 9, 7, 15, 0, 0);
  const at = (date: Date) => relativeTime(date.toISOString(), now);

  it('describes recent times', () => {
    expect(at(new Date(2026, 9, 7, 14, 59, 30))).toBe('Just now');
    expect(at(new Date(2026, 9, 7, 14, 48))).toBe('12m ago');
    expect(at(new Date(2026, 9, 7, 9, 0))).toBe('6h ago');
  });

  it('uses calendar days, not 24-hour blocks, for yesterday', () => {
    expect(at(new Date(2026, 9, 6, 23, 30))).toBe('Yesterday');
    expect(at(new Date(2026, 9, 6, 0, 5))).toBe('Yesterday');
  });

  it('shows the date for older items, with the year when it differs', () => {
    expect(at(new Date(2026, 9, 3, 12, 0))).toBe('Oct 3');
    expect(at(new Date(2025, 11, 25, 12, 0))).toBe('Dec 25, 2025');
  });

  it('returns nothing for an invalid date', () => {
    expect(relativeTime('not a date', now)).toBe('');
  });
});

describe('greeting', () => {
  it('changes through the day', () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe('Good morning');
    expect(greeting(new Date(2026, 0, 1, 13))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 0, 1, 20))).toBe('Good evening');
  });
});

describe('emoji', () => {
  it('picks a fitting emoji for groups and expenses, with a default', () => {
    expect(groupEmoji('Boracay 2026')).toBe('🏝️');
    expect(groupEmoji('Research Project')).toBe('🎓');
    expect(groupEmoji('Apartment')).toBe('🏠');
    expect(groupEmoji('Zzz')).toBe('🧾');
    expect(expenseEmoji('Grab to airport')).toBe('🚕');
    expect(expenseEmoji('Hotel')).toBe('🏨');
    expect(expenseEmoji('Dinner')).toBe('🍕');
    expect(expenseEmoji('???')).toBe('🧾');
  });
});
