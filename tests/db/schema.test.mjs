import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { createDatabase, createUser } from './helpers.mjs';

const TABLES = ['profiles', 'groups', 'group_members', 'expenses', 'expense_splits', 'settlements'];

let db;
let michael;
let juan;
let groupId;

async function createGroup(name = 'Boracay 2026') {
  const { rows } = await db.query(
    'insert into public.groups (name, created_by) values ($1, $2) returning id',
    [name, michael],
  );
  return rows[0].id;
}

async function createExpense(overrides = {}) {
  const expense = {
    group_id: groupId,
    description: 'Dinner',
    amount: '2400.00',
    paid_by: michael,
    created_by: michael,
    split_method: 'equal',
    ...overrides,
  };
  const { rows } = await db.query(
    `insert into public.expenses (group_id, description, amount, paid_by, created_by, split_method)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      expense.group_id,
      expense.description,
      expense.amount,
      expense.paid_by,
      expense.created_by,
      expense.split_method,
    ],
  );
  return rows[0].id;
}

const rejects = (promise, constraint) =>
  assert.rejects(promise, (error) => {
    assert.match(error.message, new RegExp(constraint));
    return true;
  });

before(async () => {
  db = await createDatabase();
  michael = await createUser(db, 'Michael');
  juan = await createUser(db, 'Juan');
  groupId = await createGroup();
  await db.query('insert into public.group_members (group_id, user_id) values ($1, $2), ($1, $3)', [
    groupId,
    michael,
    juan,
  ]);
});

describe('schema', () => {
  it('creates every table with row level security enabled', async () => {
    const { rows } = await db.query(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
    );
    assert.deepEqual(rows.map((row) => row.relname).sort(), [...TABLES].sort());
    assert.ok(rows.every((row) => row.relrowsecurity));
  });

  it('denies API roles everything until policies exist', async () => {
    await db.exec('set role authenticated');
    try {
      for (const table of TABLES) {
        const { rows } = await db.query(`select count(*)::int as n from public.${table}`);
        assert.equal(rows[0].n, 0, `${table} should expose no rows`);
      }
      await rejects(
        db.query('insert into public.groups (name) values ($1)', ['Sneaky']),
        'row-level security',
      );
    } finally {
      await db.exec('reset role');
    }
  });

  it('indexes every foreign key column', async () => {
    const { rows } = await db.query(`
      select c.conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and not exists (
          select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
        )`);
    // groups.created_by is only ever read alongside the group row, so it is left unindexed.
    assert.deepEqual(rows, [{ tbl: 'groups', col: 'created_by' }]);
  });
});

describe('profiles', () => {
  it('rejects blank display names and malformed wallet numbers', async () => {
    await rejects(
      db.query('update public.profiles set display_name = $1 where id = $2', ['   ', michael]),
      'profiles_display_name_length',
    );
    await rejects(
      db.query('update public.profiles set gcash_number = $1 where id = $2', ['12345', michael]),
      'profiles_gcash_number_format',
    );
    await db.query('update public.profiles set gcash_number = $1, maya_number = $2 where id = $3', [
      '09171234567',
      '+639171234567',
      michael,
    ]);
  });

  it('bumps updated_at on update', async () => {
    await db.query(
      `update public.profiles set updated_at = now() - interval '1 day' where id = $1`,
      [juan],
    );
    const { rows } = await db.query(
      `update public.profiles set display_name = 'Juan D' where id = $1
       returning updated_at > now() - interval '1 minute' as fresh`,
      [juan],
    );
    assert.equal(rows[0].fresh, true);
  });
});

describe('expenses and splits', () => {
  it('stores amounts to the centavo', async () => {
    const id = await createExpense({ amount: '1250.50' });
    const { rows } = await db.query('select amount::text from public.expenses where id = $1', [id]);
    assert.equal(rows[0].amount, '1250.50');
  });

  it('rejects zero or negative amounts, blank descriptions and unknown split methods', async () => {
    await rejects(createExpense({ amount: '0' }), 'expenses_amount_positive');
    await rejects(createExpense({ amount: '-5' }), 'expenses_amount_positive');
    await rejects(createExpense({ description: ' ' }), 'expenses_description_length');
    await rejects(createExpense({ split_method: 'percent' }), 'expenses_split_method_valid');
  });

  it('allows one non-negative split per participant', async () => {
    const id = await createExpense();
    const insert = (user, amount) =>
      db.query(
        'insert into public.expense_splits (expense_id, user_id, amount_owed) values ($1, $2, $3)',
        [id, user, amount],
      );
    await insert(michael, '1200.00');
    await rejects(insert(michael, '1200.00'), 'expense_splits_expense_user_unique');
    await rejects(insert(juan, '-1'), 'expense_splits_amount_owed_non_negative');
    await insert(juan, '1200.00');
  });

  it('deletes splits with their expense', async () => {
    const id = await createExpense();
    await db.query(
      'insert into public.expense_splits (expense_id, user_id, amount_owed) values ($1, $2, $3)',
      [id, juan, '2400.00'],
    );
    await db.query('delete from public.expenses where id = $1', [id]);
    const { rows } = await db.query(
      'select count(*)::int as n from public.expense_splits where expense_id = $1',
      [id],
    );
    assert.equal(rows[0].n, 0);
  });
});

describe('settlements', () => {
  const settle = (from, to, amount) =>
    db.query(
      `insert into public.settlements (group_id, from_user, to_user, amount, created_by)
       values ($1, $2, $3, $4, $2)`,
      [groupId, from, to, amount],
    );

  it('requires a positive amount between two different users', async () => {
    await rejects(settle(juan, michael, '0'), 'settlements_amount_positive');
    await rejects(settle(juan, juan, '100'), 'settlements_distinct_users');
    await settle(juan, michael, '600.00');
  });
});

describe('deletion behaviour', () => {
  it('refuses to delete a profile that appears in money records', async () => {
    await rejects(db.query('delete from auth.users where id = $1', [juan]), 'foreign key');
  });

  it('removes a profile with no money records, keeping groups it created', async () => {
    const carlo = await createUser(db, 'Carlo');
    const { rows: created } = await db.query(
      'insert into public.groups (name, created_by) values ($1, $2) returning id',
      ['Apartment', carlo],
    );
    await db.query('insert into public.group_members (group_id, user_id) values ($1, $2)', [
      created[0].id,
      carlo,
    ]);
    await db.query('delete from auth.users where id = $1', [carlo]);

    const { rows } = await db.query('select created_by from public.groups where id = $1', [
      created[0].id,
    ]);
    assert.equal(rows[0].created_by, null);
    const { rows: members } = await db.query(
      'select count(*)::int as n from public.group_members where user_id = $1',
      [carlo],
    );
    assert.equal(members[0].n, 0);
  });

  it('deleting a group removes its members, expenses, splits and settlements', async () => {
    const temp = await createGroup('Temp');
    await db.query('insert into public.group_members (group_id, user_id) values ($1, $2)', [
      temp,
      michael,
    ]);
    const expense = await createExpense({ group_id: temp });
    await db.query(
      'insert into public.expense_splits (expense_id, user_id, amount_owed) values ($1, $2, $3)',
      [expense, juan, '2400.00'],
    );
    await db.query(
      'insert into public.settlements (group_id, from_user, to_user, amount) values ($1, $2, $3, $4)',
      [temp, juan, michael, '100'],
    );
    await db.query('delete from public.groups where id = $1', [temp]);

    for (const [table, column, value] of [
      ['group_members', 'group_id', temp],
      ['expenses', 'group_id', temp],
      ['expense_splits', 'expense_id', expense],
      ['settlements', 'group_id', temp],
    ]) {
      const { rows } = await db.query(
        `select count(*)::int as n from public.${table} where ${column} = $1`,
        [value],
      );
      assert.equal(rows[0].n, 0, `${table} should be empty`);
    }
  });
});
