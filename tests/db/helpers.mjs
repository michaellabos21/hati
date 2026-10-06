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
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
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

/** Creates an auth user plus profile and returns the user id. */
export async function createUser(db, name) {
  const { rows } = await db.query('insert into auth.users (email) values ($1) returning id', [
    `${name.toLowerCase()}@example.com`,
  ]);
  const id = rows[0].id;
  await db.query('insert into public.profiles (id, display_name) values ($1, $2)', [id, name]);
  return id;
}
