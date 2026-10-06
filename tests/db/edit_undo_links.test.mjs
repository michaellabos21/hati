// Editing expenses, undoing payments, and invite links.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { asUser, createDatabase, createUser, joinGroup } from './helpers.mjs';

let db;
let michael, juan, ana, bea;
let group, otherGroup;

const denied = (promise) => assert.rejects(promise, /row-level security/);
const splitsJson = (splits) =>
  JSON.stringify(splits.map(([user_id, amount_owed]) => ({ user_id, amount_owed })));
const createExpense = async (paidBy, amount, splits) =>
  (
    await db.query(`select public.create_expense($1, 'Dinner', $2, $3, 'exact', $4::jsonb) as id`, [
      group,
      amount,
      paidBy,
      splitsJson(splits),
    ])
  ).rows[0].id;
const updateExpense = (id, { description = 'Dinner', amount, paidBy, splits }) =>
  db.query(`select public.update_expense($1, $2, $3, $4, 'exact', $5::jsonb)`, [
    id,
    description,
    amount,
    paidBy,
    splitsJson(splits),
  ]);
const readExpense = async (id) => {
  const expense = await db.query(
    'select description, amount::text, paid_by from public.expenses where id = $1',
    [id],
  );
  const splits = await db.query(
    'select user_id, amount_owed::text from public.expense_splits where expense_id = $1 order by amount_owed',
    [id],
  );
  return { ...expense.rows[0], splits: splits.rows.map((s) => [s.user_id, s.amount_owed]) };
};

before(async () => {
  db = await createDatabase();
  [michael, juan, ana, bea] = await Promise.all(
    ['Michael', 'Juan', 'Ana', 'Bea'].map((name) => createUser(db, name)),
  );
  const create = (owner, name) =>
    asUser(db, owner, async () => {
      const { rows } = await db.query('insert into public.groups (name) values ($1) returning id', [
        name,
      ]);
      return rows[0].id;
    });
  group = await create(michael, 'Barkada');
  otherGroup = await create(michael, 'Other');
  await joinGroup(db, group, michael, juan);
  await joinGroup(db, group, michael, ana);
});

describe('editing an expense', () => {
  let expense;

  before(async () => {
    expense = await asUser(db, michael, () =>
      createExpense(michael, 300, [
        [michael, 100],
        [juan, 200],
      ]),
    );
  });

  it('lets the person who recorded it change everything, replacing the splits', async () => {
    await asUser(db, michael, () =>
      updateExpense(expense, {
        description: '  Samgyup  ',
        amount: 900,
        paidBy: juan,
        splits: [
          [michael, 300],
          [juan, 300],
          [ana, 300],
        ],
      }),
    );
    const after = await readExpense(expense);
    assert.equal(after.description, 'Samgyup');
    assert.equal(after.amount, '900.00');
    assert.equal(after.paid_by, juan);
    assert.equal(after.splits.length, 3);
    assert.ok(after.splits.every(([, amount]) => amount === '300.00'));
  });

  it('refuses an edit whose splits do not add up, leaving the expense untouched', async () => {
    const before = await readExpense(expense);
    await asUser(db, michael, () =>
      assert.rejects(
        updateExpense(expense, { amount: 500, paidBy: michael, splits: [[juan, 400]] }),
        /Splits total/,
      ),
    );
    await asUser(db, michael, () =>
      assert.rejects(
        updateExpense(expense, { amount: 500, paidBy: michael, splits: [] }),
        /at least one/,
      ),
    );
    assert.deepEqual(await readExpense(expense), before);
  });

  it('refuses edits by anyone else', async () => {
    const before = await readExpense(expense);
    for (const other of [juan, bea]) {
      await asUser(db, other, () =>
        assert.rejects(
          updateExpense(expense, { amount: 1, paidBy: juan, splits: [[juan, 1]] }),
          /Only the person who added this expense/,
        ),
      );
    }
    assert.deepEqual(await readExpense(expense), before);
  });

  it('refuses a payer or participant who is not a member', async () => {
    await asUser(db, michael, async () => {
      await denied(updateExpense(expense, { amount: 100, paidBy: bea, splits: [[michael, 100]] }));
      await denied(updateExpense(expense, { amount: 100, paidBy: michael, splits: [[bea, 100]] }));
    });
  });

  it('cannot be moved to another group or re-attributed', async () => {
    await asUser(db, michael, async () => {
      await assert.rejects(
        db.query('update public.expenses set group_id = $1 where id = $2', [otherGroup, expense]),
        /cannot be moved/,
      );
      await assert.rejects(
        db.query('update public.expenses set created_by = $1 where id = $2', [juan, expense]),
        /cannot be changed|row-level security/,
      );
    });
  });

  it('a non-creator cannot delete splits directly', async () => {
    await asUser(db, juan, async () => {
      const result = await db.query('delete from public.expense_splits where expense_id = $1', [
        expense,
      ]);
      assert.equal(result.affectedRows, 0);
    });
  });
});

describe('undoing a payment', () => {
  const record = (from, to) =>
    db.query(
      'insert into public.settlements (group_id, from_user, to_user, amount) values ($1, $2, $3, 50) returning id',
      [group, from, to],
    );
  const remove = (id) => db.query('delete from public.settlements where id = $1', [id]);
  const exists = async (id) =>
    (await db.query('select 1 from public.settlements where id = $1', [id])).rows.length === 1;

  it('either party can remove it; a third member cannot', async () => {
    const first = (await asUser(db, juan, () => record(juan, michael))).rows[0].id;

    await asUser(db, ana, async () => assert.equal((await remove(first)).affectedRows, 0));
    assert.equal(await exists(first), true);

    // The payee removes a payment the payer recorded.
    await asUser(db, michael, async () => assert.equal((await remove(first)).affectedRows, 1));
    assert.equal(await exists(first), false);

    // The payer removes their own.
    const second = (await asUser(db, juan, () => record(juan, michael))).rows[0].id;
    await asUser(db, juan, async () => assert.equal((await remove(second)).affectedRows, 1));
  });

  it('still cannot be edited, and outsiders cannot remove it', async () => {
    const id = (await asUser(db, juan, () => record(juan, michael))).rows[0].id;
    await asUser(db, juan, async () => {
      const edit = await db.query('update public.settlements set amount = 1 where id = $1', [id]);
      assert.equal(edit.affectedRows, 0);
    });
    await asUser(db, bea, async () => assert.equal((await remove(id)).affectedRows, 0));
    assert.equal(await exists(id), true);
  });
});

describe('invite links', () => {
  let token;
  const createLink = () =>
    db.query('insert into public.group_invite_links (group_id) values ($1) returning token', [
      group,
    ]);
  const info = (t) => db.query('select * from public.get_invite_link($1)', [t]);
  const join = (t) => db.query('select public.join_group_with_link($1) as group_id', [t]);
  const isMember = async (user) =>
    (
      await db.query('select 1 from public.group_members where group_id = $1 and user_id = $2', [
        group,
        user,
      ])
    ).rows.length === 1;

  it('only members can create or see a group’s link, one per group', async () => {
    await asUser(db, bea, () => denied(createLink()));
    token = (await asUser(db, michael, createLink)).rows[0].token;
    await asUser(db, juan, () => assert.rejects(createLink(), /group_invite_links_group_id_key/));

    await asUser(db, ana, async () => {
      const { rows } = await db.query('select token from public.group_invite_links');
      assert.deepEqual(rows, [{ token }]);
    });
    await asUser(db, bea, async () => {
      assert.equal((await db.query('select 1 from public.group_invite_links')).rows.length, 0);
    });
  });

  it('shows the holder which group it is, without letting them inside', async () => {
    await asUser(db, bea, async () => {
      const { rows } = await info(token);
      assert.deepEqual(rows, [
        {
          group_id: group,
          group_name: 'Barkada',
          invited_by_name: 'Michael',
          member_count: 3,
          already_member: false,
        },
      ]);
      assert.equal((await db.query('select 1 from public.groups')).rows.length, 0);
      assert.equal((await db.query('select 1 from public.expenses')).rows.length, 0);
    });
    await asUser(db, juan, async () =>
      assert.equal((await info(token)).rows[0].already_member, true),
    );
  });

  it('reveals nothing for a wrong token or a signed-out request', async () => {
    await asUser(db, bea, async () => {
      assert.equal((await info('00000000-0000-4000-8000-000000000000')).rows.length, 0);
      await assert.rejects(join('00000000-0000-4000-8000-000000000000'), /no longer valid/);
    });
    await asUser(db, null, async () => {
      assert.equal((await info(token)).rows.length, 0);
      await assert.rejects(join(token), /Log in to join/);
    });
    await db.exec('set role anon');
    try {
      await assert.rejects(info(token), /permission denied/);
      await assert.rejects(join(token), /permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });

  it('lets the holder join by their own choice, and clears a pending personal invite', async () => {
    await asUser(db, michael, () =>
      db.query('insert into public.group_invites (group_id, invited_user) values ($1, $2)', [
        group,
        bea,
      ]),
    );
    await asUser(db, bea, async () => {
      assert.equal((await join(token)).rows[0].group_id, group);
      // Joining twice is harmless.
      assert.equal((await join(token)).rows[0].group_id, group);
    });
    assert.equal(await isMember(bea), true);
    const pending = await db.query('select 1 from public.group_invites where invited_user = $1', [
      bea,
    ]);
    assert.equal(pending.rows.length, 0);
  });

  it('stops working once expired or removed', async () => {
    const carlo = await createUser(db, 'Carlo');
    await db.query(`update public.group_invite_links set expires_at = now() - interval '1 minute'`);
    await asUser(db, carlo, async () => {
      assert.equal((await info(token)).rows.length, 0);
      await assert.rejects(join(token), /no longer valid/);
    });

    // A member replaces it: the old token is dead, the new one works.
    await asUser(db, juan, () =>
      db.query('delete from public.group_invite_links where group_id = $1', [group]),
    );
    const fresh = (await asUser(db, juan, createLink)).rows[0].token;
    assert.notEqual(fresh, token);
    await asUser(db, carlo, async () => {
      await assert.rejects(join(token), /no longer valid/);
      assert.equal((await join(fresh)).rows[0].group_id, group);
    });
    assert.equal(await isMember(carlo), true);
  });
});
