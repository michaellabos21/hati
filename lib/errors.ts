// Turns whatever was thrown (Supabase auth errors, Postgres errors, network failures) into one
// sentence a person can act on.

const FALLBACK = 'Something went wrong. Please try again.';

type ErrorLike = { message?: unknown; code?: unknown };

const RULES: { test: (message: string, code: string) => boolean; text: string | null }[] = [
  {
    test: (m) => /network request failed|failed to fetch|fetch failed|load failed/i.test(m),
    text: 'No connection. Check your internet and try again.',
  },
  { test: (m) => /invalid login credentials/i.test(m), text: 'Wrong email or password.' },
  {
    test: (m) => /should be different from the old password/i.test(m),
    text: 'Choose a password you have not used before.',
  },
  {
    test: (m) => /auth session missing|session.*expired|link is invalid or has expired/i.test(m),
    text: 'That reset link has expired. Ask for a new one.',
  },
  {
    test: (m) => /already registered|already been registered/i.test(m),
    text: 'That email already has an account. Log in instead.',
  },
  {
    test: (m) => /email not confirmed/i.test(m),
    text: 'Confirm your email first. Check your inbox for the link.',
  },
  {
    test: (m) => /rate limit|too many requests/i.test(m),
    text: 'Too many tries. Wait a minute and try again.',
  },
  {
    test: (m, code) => code === '23505' && /group_invites/.test(m),
    text: 'They already have an invite to this group.',
  },
  {
    test: (m, code) => code === '23505' && /group_members/.test(m),
    text: 'They are already in this group.',
  },
  {
    test: (m) => /row-level security/i.test(m),
    text: 'You do not have permission to do that.',
  },
  {
    test: (m, code) => code === '23503',
    text: 'That refers to someone or something that no longer exists.',
  },
  // Messages raised on purpose by the database (see supabase/migrations) are already friendly.
  { test: (m, code) => code === '23514' && !/violates check constraint/.test(m), text: null },
  { test: (m, code) => code === '23514', text: 'Some of those details are not valid.' },
];

export function toMessage(error: unknown): string {
  if (typeof error === 'string') return error || FALLBACK;
  if (typeof error !== 'object' || error === null) return FALLBACK;

  const { message, code } = error as ErrorLike;
  const text = typeof message === 'string' ? message : '';
  const pgCode = typeof code === 'string' ? code : '';

  for (const rule of RULES) {
    if (rule.test(text, pgCode)) return rule.text ?? text;
  }
  // Auth errors from Supabase are short and written for end users; database errors are not.
  if (text && !pgCode && text.length <= 120) return text;
  return FALLBACK;
}
