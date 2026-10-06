# HATI 🇵🇭

**"Sino may bayad? Sino may utang? Hati na."**

A Filipino-first expense splitting app for barkadas, trips, households and school groups.
The full product and engineering brief is in [MVP_PLAN.md](MVP_PLAN.md); work proceeds through
its tasks in order (TASK 001–021).

## Status

- [x] TASK 001 — Project initialization (Expo + TypeScript + Expo Router shell, lint, tests)
- [x] TASK 002 — Supabase client and env validation (live connection check pending credentials)
- [ ] TASK 003 — Database migrations

## Stack

- Expo SDK 57, React Native, TypeScript, Expo Router
- Styling: plain `StyleSheet` with design tokens in `constants/theme.ts` (no other styling library)
- Supabase (Postgres, Auth, RLS) — added from TASK 002
- Jest (`jest-expo`), ESLint (`eslint-config-expo`), Prettier

## Getting started

```bash
npm install
cp .env.example .env   # add your Supabase URL and anon key
npm run check:supabase # confirm the project is reachable
npm start              # then press i / a / w, or: npm run web
```

## Scripts

| Script                   | What it does                                       |
| ------------------------ | -------------------------------------------------- |
| `npm start`              | Start the Expo dev server                          |
| `npm run web`            | Start and open in a web browser                    |
| `npm run typecheck`      | `tsc --noEmit`                                     |
| `npm run lint`           | ESLint via `expo lint`                             |
| `npm test`               | Jest unit tests in `tests/`                        |
| `npm run format`         | Format with Prettier                               |
| `npm run check:supabase` | Verify the Supabase project in `.env` is reachable |

## Structure

```text
app/                  Routes (Expo Router). Screens only, no business logic.
  (tabs)/             Home, Groups, Activity, Profile
  auth/               login, signup
  groups/             create, [id]/ (detail, add-expense, settle)
  expenses/[id].tsx
components/           Shared UI
constants/            Design tokens, app name/tagline
features/             auth, groups, expenses, balances, settlements (pure logic + data access)
lib/                  supabase client, currency, calculations
hooks/  types/
supabase/migrations/  SQL migrations and RLS policies
tests/                Jest tests
```

Import with the `@/` alias, e.g. `import { colors } from '@/constants/theme'`.

## Engineering rules (from the brief)

1. Money is handled in integer centavos; no floating-point arithmetic on currency.
2. Financial calculations are pure functions under `features/` and `lib/`, never inside components.
3. The server is authoritative: every table has Row Level Security.
4. Keep the MVP small: expense → balance → settlement.
