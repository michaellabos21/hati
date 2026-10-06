# HATI 🇵🇭

**"Sino may bayad? Sino may utang? Hati na."**

A Filipino-first expense splitting app for barkadas, trips, households and school groups.
The full product and engineering brief is in [MVP_PLAN.md](MVP_PLAN.md); work proceeds through
its tasks in order (TASK 001–021).

## Status

- [x] TASK 001 — Project initialization (Expo + TypeScript + Expo Router shell, lint, tests)
- [x] TASK 002 — Supabase client and env validation (live connection check pending credentials)
- [x] TASK 003 — Database migrations (verified in local Postgres; not yet applied to Supabase)
- [ ] TASK 004 — RLS policies

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

| Script                   | What it does                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| `npm start`              | Start the Expo dev server                                          |
| `npm run web`            | Start and open in a web browser                                    |
| `npm run typecheck`      | `tsc --noEmit`                                                     |
| `npm run lint`           | ESLint via `expo lint`                                             |
| `npm test`               | Jest unit tests in `tests/`                                        |
| `npm run format`         | Format with Prettier                                               |
| `npm run test:db`        | Apply the migrations to an in-memory Postgres and test constraints |
| `npm run check:supabase` | Verify the Supabase project in `.env` is reachable                 |

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

## Database

Migrations live in `supabase/migrations/` and are applied in filename order. To apply them to a
hosted project, either paste each file into the Supabase SQL editor or use the Supabase CLI
(`supabase link` then `supabase db push`).

`npm run test:db` applies the migrations to an in-memory Postgres (PGlite) with Supabase's `auth`
schema stubbed, and checks constraints, cascades and that RLS is enabled. It verifies the SQL, not
the hosted project.
