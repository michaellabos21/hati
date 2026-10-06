// Tests for the server-side functions and triggers the app calls or depends on.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { asUser, createDatabase, createUser, emailFor, joinGroup } from './helpers.mjs';

let db;
let michael, juan, bea;
let group;

const createExpense = (args) =>
  db.query(`select public.create_expense($1, $2, $3, $4, $5, $6::jsonb) as id`, [
    args.group ?? group,
    args.description ?? 'Dinner',
    args.amount,
    args.paidBy,
    args.method ?? 'equal',
    JSON.stringify(args.splits.map(([user_id, amount_owed]) => ({ user_id, amount_owed }))),
  ]);

before(async () => {
  db = await createDatabase();
  [michael, juan, bea] = await Promise.all(
    ['Michael', 'Juan', 'Bea'].map((n) => createUser(db, n)),
  );
  group = await asUser(db, michael, async () => {
    const { rows } = await db.query(
      `insert into public.groups (name) values ('Barkada') returning id`,
    );
    return rows[0].id;
  });
  await joinGroup(db, group, michael, juan);
});

describe('profile on sign-up', () => {
  it('uses the display name from sign-up', async () => {
    const { rows } = await db.query('select display_name from public.profiles where id = $1', [
      michael,
    ]);
    assert.equal(rows[0].display_name, 'Michael');
  });

  it('falls back to the email name, and never blocks sign-up', async () => {
    const cases = [
      ['nometa@example.com', null, 'nometa'],
      ['blank@example.com', { display_name: '   ' }, 'blank'],
      ['long@example.com', { display_name: 'x'.repeat(200) }, 'x'.repeat(60)],
      [null, null, 'Kaibigan'],
    ];
    for (const [email, meta, expected] of cases) {
      const { rows } = await db.query(
        `with u as (
           insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id
         ) select id from u`,
        [email, meta && JSON.stringify(meta)],
      );
      const profile = await db.query('select display_name from public.profiles where id = $1', [
        rows[0].id,
      ]);
      assert.equal(profile.rows[0].display_name, expected);
    }
  });
});

describe('find_user_by_email', () => {
  const find = (email) => db.query('select * from public.find_user_by_email($1)', [email]);

  it('finds a user by exact email, ignoring case and surrounding spaces', async () => {
    await asUser(db, michael, async () => {
      const { rows } = await find(`  ${emailFor('Bea').toUpperCase()} `);
      assert.deepEqual(rows, [{ id: bea, display_name: 'Bea' }]);
    });
  });

  it('does not match partial emails or wildcards', async () => {
    await asUser(db, michael, async () => {
      for (const probe of ['bea', 'bea@', '%@example.com', 'b_a@example.com', '']) {
        assert.equal((await find(probe)).rows.length, 0, probe);
      }
    });
  });

  it('returns nothing without a signed-in user and is not callable by anon', async () => {
    await asUser(db, null, async () => {
      assert.equal((await find(emailFor('Bea'))).rows.length, 0);
    });
    await db.exec('set role anon');
    try {
      await assert.rejects(find(emailFor('Bea')), /permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
});

describe('create_expense', () => {
  it('writes the expense and its splits together, recorded as the caller', async () => {
    await asUser(db, juan, async () => {
      const { rows } = await createExpense({
        amount: 2400,
        paidBy: michael,
        splits: [
          [michael, 1200],
          [juan, 1200],
        ],
      });
      const expense = await db.query(
        'select created_by, paid_by, amount::text from public.expenses where id = $1',
        [rows[0].id],
      );
      assert.deepEqual(expense.rows, [{ created_by: juan, paid_by: michael, amount: '2400.00' }]);
      const splits = await db.query(
        'select count(*)::int as n from public.expense_splits where expense_id = $1',
        [rows[0].id],
      );
      assert.equal(splits.rows[0].n, 2);
    });
  });

  it('rejects splits that do not add up, leaving nothing behind', async () => {
    const before = await db.query('select count(*)::int as n from public.expenses');
    await asUser(db, juan, () =>
      assert.rejects(
        createExpense({ amount: 2400, paidBy: michael, splits: [[juan, 2000]] }),
        /Splits total/,
      ),
    );
    await asUser(db, juan, () =>
      assert.rejects(createExpense({ amount: 2400, paidBy: michael, splits: [] }), /at least one/),
    );
    const after = await db.query('select count(*)::int as n from public.expenses');
    assert.equal(after.rows[0].n, before.rows[0].n);
  });

  it('is still subject to row level security', async () => {
    // Bea is not in the group.
    await asUser(db, bea, () =>
      assert.rejects(
        createExpense({ amount: 100, paidBy: michael, splits: [[michael, 100]] }),
        /row-level security/,
      ),
    );
    // A member cannot include a non-member in the split or name one as payer.
    await asUser(db, juan, async () => {
      await assert.rejects(
        createExpense({ amount: 100, paidBy: michael, splits: [[bea, 100]] }),
        /row-level security/,
      );
      await assert.rejects(
        createExpense({ amount: 100, paidBy: bea, splits: [[juan, 100]] }),
        /row-level security/,
      );
    });
  });
});

describe('leaving a group', () => {
  const leave = (user) =>
    db.query('delete from public.group_members where group_id = $1 and user_id = $2', [
      group,
      user,
    ]);

  it('is blocked while the member owes or is owed money', async () => {
    // From the expense above, Juan owes Michael ₱1,200.
    await asUser(db, juan, () => assert.rejects(leave(juan), /Settle up before leaving/));
    await asUser(db, michael, () => assert.rejects(leave(michael), /Settle up before leaving/));
  });

  it('is allowed once the member is settled', async () => {
    await asUser(db, juan, async () => {
      await db.query(
        'insert into public.settlements (group_id, from_user, to_user, amount) values ($1, $2, $3, 1200)',
        [group, juan, michael],
      );
      const result = await leave(juan);
      assert.equal(result.affectedRows, 1);
    });
  });
});
