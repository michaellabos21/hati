// Spins up an in-memory Postgres (PGlite) with just enough of Supabase's auth schema stubbed
// for the migrations in supabase/migrations to apply. This checks the SQL itself; it is not a
// substitute for testing against a real Supabase project.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', 'supabase', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

export async function createDatabase() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (file.endsWith('.sql')) {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    }
  }
  return db;
}

/** Signs up a user (the profile is created by the on_auth_user_created trigger). */
export async function createUser(db, name) {
  const { rows } = await db.query(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
    [emailFor(name), JSON.stringify({ display_name: name })],
  );
  return rows[0].id;
}

export const emailFor = (name) => `${name.toLowerCase()}@example.com`;

/**
 * Writes an expense and its splits in one transaction, the way create_expense does, but with
 * direct inserts so tests can exercise the tables and policies themselves.
 * `splits` is a list of [userId, amount].
 */
export async function insertExpenseWithSplits(db, expense, splits) {
  const row = { description: 'Dinner', split_method: 'exact', ...expense };
  await db.exec('begin');
  try {
    const { rows } = await db.query(
      `insert into public.expenses (group_id, description, amount, paid_by, split_method, created_by)
       values ($1, $2, $3, $4, $5, coalesce($6, auth.uid())) returning id`,
      [
        row.group_id,
        row.description,
        row.amount,
        row.paid_by,
        row.split_method,
        row.created_by ?? null,
      ],
    );
    for (const [userId, amount] of splits) {
      await db.query(
        'insert into public.expense_splits (expense_id, user_id, amount_owed) values ($1, $2, $3)',
        [rows[0].id, userId, amount],
      );
    }
    await db.exec('commit');
    return rows[0].id;
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}

/**
 * Runs `fn` as a signed-in user: the `authenticated` role with auth.uid() returning `userId`.
 * Pass null for a request with no user.
 */
export async function asUser(db, userId, fn) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  await db.exec('set role authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

/**
 * Adds someone to a group the way the app does: a member invites them and they accept.
 * Call it outside any asUser block.
 */
export async function joinGroup(db, groupId, inviterId, inviteeId) {
  const invite = await asUser(db, inviterId, () =>
    db.query(
      'insert into public.group_invites (group_id, invited_user) values ($1, $2) returning id',
      [groupId, inviteeId],
    ),
  );
  await asUser(db, inviteeId, () =>
    db.query('select public.accept_group_invite($1)', [invite.rows[0].id]),
  );
}
