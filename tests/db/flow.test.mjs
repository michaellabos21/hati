// End-to-end check of the MVP's Definition of Done at the database level: two users go through
// sign-up -> group -> member -> expense -> balances -> settlement, entirely through the API
// surface (policies and RPCs), with balances computed by the app's own calculation engine.
//
// It also loads the Boracay 2026 seed scenario from the brief with several payers.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import {
  calculateGroupBalances,
  isSettled,
  simplifyDebts,
} from '../../features/balances/calculations.ts';
import { asUser, createDatabase, createUser, emailFor } from './helpers.mjs';

let db;

const centavos = (numeric) => Math.round(Number(numeric) * 100);

/** Reads a group's ledger as `user` and returns balances from the app's engine. */
async function balancesFor(user, group) {
  return asUser(db, user, async () => {
    const members = await db.query('select user_id from public.group_members where group_id = $1', [
      group,
    ]);
    const expenses = await db.query(
      `select e.id, e.paid_by, e.amount,
              (select json_agg(json_build_object('userId', s.user_id, 'amount', s.amount_owed))
               from public.expense_splits s where s.expense_id = e.id) as splits
       from public.expenses e where e.group_id = $1`,
      [group],
    );
    const settlements = await db.query(
      'select from_user, to_user, amount from public.settlements where group_id = $1',
      [group],
    );
    return calculateGroupBalances(
      expenses.rows.map((e) => ({
        paidBy: e.paid_by,
        amount: centavos(e.amount),
        splits: e.splits.map((s) => ({ userId: s.userId, amount: centavos(s.amount) })),
      })),
      settlements.rows.map((s) => ({
        from: s.from_user,
        to: s.to_user,
        amount: centavos(s.amount),
      })),
      members.rows.map((m) => m.user_id),
    );
  });
}

const createGroup = async (name) =>
  (await db.query('insert into public.groups (name) values ($1) returning id', [name])).rows[0].id;

/** As the signed-in member: find someone by email and invite them. Returns who and which invite. */
const inviteByEmail = async (group, email) => {
  const found = await db.query('select id from public.find_user_by_email($1)', [email]);
  assert.equal(found.rows.length, 1, `no user for ${email}`);
  const invite = await db.query(
    'insert into public.group_invites (group_id, invited_user) values ($1, $2) returning id',
    [group, found.rows[0].id],
  );
  return { userId: found.rows[0].id, inviteId: invite.rows[0].id };
};

/** As the invited person: see the invite on their list and accept it. */
const acceptInvite = ({ userId, inviteId }) =>
  asUser(db, userId, async () => {
    const mine = await db.query('select id, group_name from public.get_my_invites()');
    assert.ok(
      mine.rows.some((row) => row.id === inviteId),
      'the invite should be on their list',
    );
    await db.query('select public.accept_group_invite($1)', [inviteId]);
  });

/** Equal split in centavos with the leftover going to the first people, as the app does. */
const equalShares = (amount, people) => {
  const total = Math.round(amount * 100);
  const base = Math.floor(total / people.length);
  const extra = total - base * people.length;
  return people.map((user_id, i) => ({ user_id, amount_owed: (base + (i < extra ? 1 : 0)) / 100 }));
};

const addEqualExpense = (group, description, amount, paidBy, people) =>
  db.query(`select public.create_expense($1, $2, $3, $4, 'equal', $5::jsonb)`, [
    group,
    description,
    amount,
    paidBy,
    JSON.stringify(equalShares(amount, people)),
  ]);

const settle = (group, from, to, amountCentavos) =>
  db.query(
    'insert into public.settlements (group_id, from_user, to_user, amount) values ($1, $2, $3, $4)',
    [group, from, to, amountCentavos / 100],
  );

before(async () => {
  db = await createDatabase();
});

describe('definition of done', () => {
  it('sign up, group, member, ₱2,400 expense, balances, settlement, balances update', async () => {
    const michael = await createUser(db, 'Michael'); // 1. sign up
    const juan = await createUser(db, 'Juan');

    const group = await asUser(db, michael, () => createGroup('Barkada')); // 2. create a group

    // 3. Add another user: Michael invites Juan by email, and Juan accepts.
    const invite = await asUser(db, michael, () => inviteByEmail(group, emailFor('Juan')));
    await acceptInvite(invite);

    // 4-6. A ₱2,400 expense, paid by Michael, split equally.
    await asUser(db, michael, () =>
      addEqualExpense(group, 'Dinner', 2400, michael, [michael, juan]),
    );

    // 7. Both members see exactly who owes whom.
    for (const viewer of [michael, juan]) {
      const balances = await balancesFor(viewer, group);
      assert.deepEqual(balances, { [michael]: 120000, [juan]: -120000 });
      assert.deepEqual(simplifyDebts(balances), [{ from: juan, to: michael, amount: 120000 }]);
    }

    // 9. Juan records a partial payment, then the rest. 10. Balances follow.
    await asUser(db, juan, () => settle(group, juan, michael, 50000));
    assert.deepEqual(await balancesFor(michael, group), { [michael]: 70000, [juan]: -70000 });

    await asUser(db, michael, () => settle(group, juan, michael, 70000));
    const final = await balancesFor(juan, group);
    assert.equal(isSettled(final), true);
    assert.deepEqual(simplifyDebts(final), []);

    // Settlement history is kept.
    const history = await asUser(db, juan, () =>
      db.query('select amount::text from public.settlements where group_id = $1 order by amount', [
        group,
      ]),
    );
    assert.deepEqual(
      history.rows.map((r) => r.amount),
      ['500.00', '700.00'],
    );
  });
});

describe('Boracay 2026 seed scenario', () => {
  it('multiple payers: suggested payments settle the whole group', async () => {
    const names = ['Miguel', 'Jose', 'Ana', 'Bea', 'Carlo'];
    const ids = [];
    for (const name of names) ids.push(await createUser(db, name));
    const [miguel, jose, ana, bea, carlo] = ids;

    const group = await asUser(db, miguel, () => createGroup('Boracay 2026'));
    for (const name of names.slice(1)) {
      const invite = await asUser(db, miguel, () => inviteByEmail(group, emailFor(name)));
      await acceptInvite(invite);
    }

    await asUser(db, miguel, () => addEqualExpense(group, 'Dinner', 2400, miguel, ids));
    await asUser(db, miguel, () => addEqualExpense(group, 'Hotel', 5000, miguel, ids));
    await asUser(db, ana, () => addEqualExpense(group, 'Grab', 800, ana, ids));
    await asUser(db, bea, () => addEqualExpense(group, 'Beach fees', 1000, bea, ids));

    // Total 9,200 -> 1,840 each.
    const balances = await balancesFor(carlo, group);
    assert.deepEqual(balances, {
      [miguel]: 740000 - 184000,
      [ana]: 80000 - 184000,
      [bea]: 100000 - 184000,
      [jose]: -184000,
      [carlo]: -184000,
    });

    const transfers = simplifyDebts(balances);
    assert.ok(transfers.length <= 4);
    assert.ok(transfers.every((t) => t.to === miguel));

    // Each debtor records their own suggested payment.
    for (const transfer of transfers) {
      await asUser(db, transfer.from, () =>
        settle(group, transfer.from, transfer.to, transfer.amount),
      );
    }
    assert.equal(isSettled(await balancesFor(jose, group)), true);

    // An outsider sees none of it.
    const outsider = await createUser(db, 'Dayo');
    assert.deepEqual(await balancesFor(outsider, group), {});
  });
});
