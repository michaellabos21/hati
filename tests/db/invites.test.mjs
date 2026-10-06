// Joining a group needs the invited person's consent.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { asUser, createDatabase, createUser, joinGroup } from './helpers.mjs';

let db;
let michael, juan, ana, bea;
let group;

const denied = (promise) => assert.rejects(promise, /row-level security/);
const invite = (invitee) =>
  db.query(
    'insert into public.group_invites (group_id, invited_user) values ($1, $2) returning id',
    [group, invitee],
  );
const accept = (id) => db.query('select public.accept_group_invite($1) as group_id', [id]);
const isMember = async (user) =>
  (
    await db.query('select 1 from public.group_members where group_id = $1 and user_id = $2', [
      group,
      user,
    ])
  ).rows.length === 1;
const createExpense = (paidBy, splits, amount) =>
  db.query(`select public.create_expense($1, 'Dinner', $2, $3, 'exact', $4::jsonb)`, [
    group,
    amount,
    paidBy,
    JSON.stringify(splits.map(([user_id, amount_owed]) => ({ user_id, amount_owed }))),
  ]);

before(async () => {
  db = await createDatabase();
  [michael, juan, ana, bea] = await Promise.all(
    ['Michael', 'Juan', 'Ana', 'Bea'].map((name) => createUser(db, name)),
  );
  group = await asUser(db, michael, async () => {
    const { rows } = await db.query(
      `insert into public.groups (name) values ('Barkada') returning id`,
    );
    return rows[0].id;
  });
});

describe('nobody can be added without agreeing', () => {
  it('a member cannot insert a membership for someone else', async () => {
    await asUser(db, michael, () =>
      denied(
        db.query('insert into public.group_members (group_id, user_id) values ($1, $2)', [
          group,
          juan,
        ]),
      ),
    );
    assert.equal(await isMember(juan), false);
  });

  it('an invited person is not a member, and cannot be put in an expense or a payment', async () => {
    await asUser(db, michael, () => invite(juan));
    assert.equal(await isMember(juan), false);

    await asUser(db, michael, async () => {
      await denied(createExpense(michael, [[juan, 100]], 100));
      await denied(createExpense(juan, [[michael, 100]], 100));
      await denied(
        db.query(
          'insert into public.settlements (group_id, from_user, to_user, amount) values ($1, $2, $3, 50)',
          [group, michael, juan],
        ),
      );
    });
  });

  it('an invited person cannot see inside the group before accepting', async () => {
    await asUser(db, juan, async () => {
      for (const table of ['groups', 'group_members', 'expenses', 'settlements']) {
        assert.equal((await db.query(`select 1 from public.${table}`)).rows.length, 0, table);
      }
    });
  });
});

describe('invites', () => {
  it('the invited person sees which group, who asked and how big it is', async () => {
    await asUser(db, juan, async () => {
      const { rows } = await db.query(
        'select group_id, group_name, invited_by_name, member_count from public.get_my_invites()',
      );
      assert.deepEqual(rows, [
        { group_id: group, group_name: 'Barkada', invited_by_name: 'Michael', member_count: 1 },
      ]);
    });
    await asUser(db, ana, async () => {
      assert.equal((await db.query('select 1 from public.get_my_invites()')).rows.length, 0);
    });
  });

  it('members see who is pending; outsiders do not', async () => {
    await asUser(db, michael, async () => {
      const { rows } = await db.query(
        'select invited_user, display_name from public.get_group_invites($1)',
        [group],
      );
      assert.deepEqual(rows, [{ invited_user: juan, display_name: 'Juan' }]);
    });
    await asUser(db, ana, async () => {
      const { rows } = await db.query('select 1 from public.get_group_invites($1)', [group]);
      assert.equal(rows.length, 0);
      assert.equal((await db.query('select 1 from public.group_invites')).rows.length, 0);
    });
  });

  it('cannot be sent twice, by an outsider, in someone else’s name, or to a member', async () => {
    await asUser(db, michael, () => assert.rejects(invite(juan), /group_invites_one_per_person/));
    await asUser(db, ana, () => denied(invite(bea)));
    await asUser(db, michael, async () => {
      await denied(
        db.query(
          'insert into public.group_invites (group_id, invited_user, invited_by) values ($1, $2, $3)',
          [group, bea, ana],
        ),
      );
      await denied(invite(michael));
    });
  });

  it('only the invited person can accept', async () => {
    const { rows } = await db.query('select id from public.group_invites where invited_user = $1', [
      juan,
    ]);
    const id = rows[0].id;

    for (const impostor of [michael, ana]) {
      await asUser(db, impostor, () => assert.rejects(accept(id), /no longer available/));
    }
    assert.equal(await isMember(juan), false);

    await asUser(db, juan, async () => {
      const result = await accept(id);
      assert.equal(result.rows[0].group_id, group);
    });
    assert.equal(await isMember(juan), true);

    // The invite is used up.
    await asUser(db, juan, () => assert.rejects(accept(id), /no longer available/));
    const left = await db.query('select 1 from public.group_invites where id = $1', [id]);
    assert.equal(left.rows.length, 0);
  });

  it('once accepted, the new member can be included in expenses', async () => {
    await asUser(db, michael, () => createExpense(michael, [[juan, 100]], 100));
  });

  it('the invited person can decline, and a member can withdraw', async () => {
    const first = await asUser(db, michael, () => invite(ana));
    await asUser(db, ana, async () => {
      const declined = await db.query('delete from public.group_invites where id = $1', [
        first.rows[0].id,
      ]);
      assert.equal(declined.affectedRows, 1);
    });
    assert.equal(await isMember(ana), false);

    const second = await asUser(db, michael, () => invite(ana));
    // Bea is neither invited nor a member, so she cannot remove it.
    await asUser(db, bea, async () => {
      const result = await db.query('delete from public.group_invites where id = $1', [
        second.rows[0].id,
      ]);
      assert.equal(result.affectedRows, 0);
    });
    await asUser(db, juan, async () => {
      const withdrawn = await db.query('delete from public.group_invites where id = $1', [
        second.rows[0].id,
      ]);
      assert.equal(withdrawn.affectedRows, 1);
    });
  });

  it('are not readable or callable by anon', async () => {
    await db.exec('set role anon');
    try {
      await assert.rejects(db.query('select 1 from public.group_invites'), /permission denied/);
      await assert.rejects(db.query('select public.get_my_invites()'), /permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
});

describe('leaving', () => {
  const leave = (user) =>
    db.query('delete from public.group_members where group_id = $1 and user_id = $2', [
      group,
      user,
    ]);

  it('someone who only had a share assigned to them can always leave', async () => {
    // Juan has been given a ₱100 share but has never paid, recorded or settled anything.
    await asUser(db, juan, async () => {
      const result = await leave(juan);
      assert.equal(result.affectedRows, 1);
    });
    assert.equal(await isMember(juan), false);
  });

  it('someone who has paid or recorded something must settle up first', async () => {
    await joinGroup(db, group, michael, bea);
    await asUser(db, bea, () => createExpense(bea, [[michael, 300]], 300));
    await asUser(db, bea, () => assert.rejects(leave(bea), /Settle up before leaving/));
    await asUser(db, michael, () => assert.rejects(leave(michael), /Settle up before leaving/));
  });
});

describe('premium interest', () => {
  const register = () => db.query('insert into public.premium_interest default values');
  const mine = async () => (await db.query('select user_id from public.premium_interest')).rows;

  it('records one row per person, visible only to them', async () => {
    await asUser(db, michael, async () => {
      assert.deepEqual(await mine(), []);
      await register();
      assert.deepEqual(await mine(), [{ user_id: michael }]);
      await assert.rejects(register(), /premium_interest_pkey/);
    });
    await asUser(db, ana, async () => {
      assert.deepEqual(await mine(), []);
      await assert.rejects(
        db.query('insert into public.premium_interest (user_id) values ($1)', [juan]),
        /row-level security/,
      );
    });
    const all = await db.query('select count(*)::int as n from public.premium_interest');
    assert.equal(all.rows[0].n, 1);
  });
});
