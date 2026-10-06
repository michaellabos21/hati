import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { createDatabase, createUser, insertExpenseWithSplits } from './helpers.mjs';

const TABLES = [
  'profiles',
  'groups',
  'group_members',
  'expenses',
  'expense_splits',
  'settlements',
  'group_invites',
  'premium_interest',
  'group_invite_links',
];

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

/** An expense Michael paid and recorded, owed entirely by Juan unless splits are given. */
function createExpense(overrides = {}, splits) {
  const expense = {
    group_id: groupId,
    amount: '2400.00',
    paid_by: michael,
    created_by: michael,
    ...overrides,
  };
  return insertExpenseWithSplits(db, expense, splits ?? [[juan, expense.amount]]);
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
  // Michael is added as a member by the groups trigger.
  await db.query('insert into public.group_members (group_id, user_id) values ($1, $2)', [
    groupId,
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

  it('gives the anon role no access to any table', async () => {
    await db.exec('set role anon');
    try {
      for (const table of TABLES) {
        await rejects(db.query(`select 1 from public.${table}`), 'permission denied');
      }
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
    await rejects(
      createExpense({}, [
        [michael, '1200.00'],
        [michael, '1200.00'],
      ]),
      'expense_splits_expense_user_unique',
    );
    await rejects(
      createExpense({}, [
        [michael, '2401.00'],
        [juan, '-1'],
      ]),
      'expense_splits_amount_owed_non_negative',
    );
    await createExpense({}, [
      [michael, '1200.00'],
      [juan, '1200.00'],
    ]);
  });

  it('requires splits that add up to the expense exactly', async () => {
    await rejects(createExpense({}, []), 'at least one person');
    await rejects(createExpense({}, [[juan, '2399.99']]), 'Splits total');
    await rejects(
      createExpense({}, [
        [michael, '1200.00'],
        [juan, '1200.01'],
      ]),
      'Splits total',
    );
  });

  it('requires an equal split to be equal, allowing the leftover centavo', async () => {
    await rejects(
      createExpense({ split_method: 'equal', amount: '100.00' }, [
        [michael, '70.00'],
        [juan, '30.00'],
      ]),
      'equal split',
    );
    await createExpense({ split_method: 'equal', amount: '100.01' }, [
      [michael, '50.01'],
      [juan, '50.00'],
    ]);
  });

  it('rejects tampering with a split after the fact', async () => {
    const id = await createExpense();
    await rejects(
      db.query('update public.expense_splits set amount_owed = 1 where expense_id = $1', [id]),
      'Splits total',
    );
    await rejects(
      db.query('delete from public.expense_splits where expense_id = $1', [id]),
      'at least one person',
    );
    await rejects(
      db.query('update public.expenses set amount = 1 where id = $1', [id]),
      'Splits total',
    );
  });

  it('deletes splits with their expense', async () => {
    const id = await createExpense();
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
    // Juan still owes money here, so leaving the group is refused; a settled user would
    // instead be stopped by the foreign keys from the money tables.
    await rejects(
      db.query('delete from auth.users where id = $1', [juan]),
      'Settle up|foreign key',
    );
  });

  it('removes a profile with no money records, keeping groups it created', async () => {
    const carlo = await createUser(db, 'Carlo');
    const { rows: created } = await db.query(
      'insert into public.groups (name, created_by) values ($1, $2) returning id',
      ['Apartment', carlo],
    );
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
    const expense = await createExpense({ group_id: temp });
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
