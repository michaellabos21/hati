// Row Level Security tests. Each case acts as a specific signed-in user and checks what the
// database itself allows, independent of any client code.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import {
  asUser,
  createDatabase,
  createUser,
  insertExpenseWithSplits,
  joinGroup,
} from './helpers.mjs';

let db;
// Michael, Juan and Ana share "Boracay". Bea has her own private group. Carlo is in nothing.
let michael, juan, ana, bea, carlo;
let boracay, beaGroup;
let dinner; // expense in Boracay recorded by Michael
let beaExpense;

const count = async (sql, params = []) => (await db.query(sql, params)).rows.length;

const denied = (promise) =>
  assert.rejects(promise, (error) => {
    assert.match(error.message, /row-level security/);
    return true;
  });

/** Asserts a statement ran but RLS hid every row from it. */
const affectsNothing = async (promise) => {
  const result = await promise;
  assert.equal(result.affectedRows, 0);
};

const insertExpense = (group, paidBy, extra = {}) =>
  db.query(
    `insert into public.expenses (group_id, description, amount, paid_by, split_method, created_by)
     values ($1, 'Dinner', 2400, $2, 'equal', coalesce($3, auth.uid())) returning id`,
    [group, paidBy, extra.createdBy ?? null],
  );

const insertSplit = (expense, user, amount = 600) =>
  db.query(
    'insert into public.expense_splits (expense_id, user_id, amount_owed) values ($1, $2, $3)',
    [expense, user, amount],
  );

const insertSettlement = (group, from, to, amount = 600) =>
  db.query(
    'insert into public.settlements (group_id, from_user, to_user, amount) values ($1, $2, $3, $4)',
    [group, from, to, amount],
  );

before(async () => {
  db = await createDatabase();
  [michael, juan, ana, bea, carlo] = await Promise.all(
    ['Michael', 'Juan', 'Ana', 'Bea', 'Carlo'].map((name) => createUser(db, name)),
  );
  await db.query(`update public.profiles set gcash_number = '09171234567' where id = $1`, [
    michael,
  ]);

  // Build the fixture through the policies themselves, as real users.
  boracay = await asUser(db, michael, async () => {
    const { rows } = await db.query(
      `insert into public.groups (name) values ('Boracay 2026') returning id, created_by`,
    );
    assert.equal(rows[0].created_by, michael, 'created_by defaults to the signed-in user');
    return rows[0].id;
  });
  await joinGroup(db, boracay, michael, juan);
  await joinGroup(db, boracay, michael, ana);
  dinner = await asUser(db, michael, () =>
    insertExpenseWithSplits(db, { group_id: boracay, amount: 2400, paid_by: michael }, [
      [michael, 800],
      [juan, 800],
      [ana, 800],
    ]),
  );
  await asUser(db, juan, () => insertSettlement(boracay, juan, michael, 300));

  beaGroup = await asUser(db, bea, async () => {
    const { rows } = await db.query(
      `insert into public.groups (name) values ('Bea private') returning id`,
    );
    return rows[0].id;
  });
  beaExpense = await asUser(db, bea, () =>
    insertExpenseWithSplits(db, { group_id: beaGroup, amount: 2400, paid_by: bea }, [[bea, 2400]]),
  );
});

describe('group creation', () => {
  it('makes the creator the first member automatically', async () => {
    await asUser(db, bea, async () => {
      const { rows } = await db.query(
        'select user_id from public.group_members where group_id = $1',
        [beaGroup],
      );
      assert.deepEqual(rows, [{ user_id: bea }]);
    });
  });

  it('cannot create a group in someone else’s name', async () => {
    await asUser(db, carlo, () =>
      denied(
        db.query(`insert into public.groups (name, created_by) values ('Forged', $1)`, [michael]),
      ),
    );
  });
});

describe('reading', () => {
  it('members see their group, its members, expenses, splits and settlements', async () => {
    await asUser(db, juan, async () => {
      assert.equal(await count('select 1 from public.groups'), 1);
      assert.equal(await count('select 1 from public.group_members'), 3);
      assert.equal(await count('select 1 from public.expenses'), 1);
      assert.equal(await count('select 1 from public.expense_splits'), 3);
      assert.equal(await count('select 1 from public.settlements'), 1);
    });
  });

  it('a user in another group cannot read a private group or anything in it', async () => {
    await asUser(db, bea, async () => {
      assert.equal(await count('select 1 from public.groups where id = $1', [boracay]), 0);
      assert.equal(
        await count('select 1 from public.group_members where group_id = $1', [boracay]),
        0,
      );
      assert.equal(await count('select 1 from public.expenses where group_id = $1', [boracay]), 0);
      assert.equal(
        await count('select 1 from public.expense_splits where expense_id = $1', [dinner]),
        0,
      );
      assert.equal(
        await count('select 1 from public.settlements where group_id = $1', [boracay]),
        0,
      );
    });
  });

  it('a user in no group, or a request with no user, reads nothing', async () => {
    for (const user of [carlo, null]) {
      await asUser(db, user, async () => {
        for (const table of ['groups', 'group_members', 'expenses', 'expense_splits']) {
          assert.equal(await count(`select 1 from public.${table}`), 0, table);
        }
        assert.equal(await count('select 1 from public.settlements'), 0);
      });
    }
  });
});

describe('profiles', () => {
  it('group mates can see each other’s name but never their wallet numbers', async () => {
    await asUser(db, juan, async () => {
      const { rows } = await db.query('select display_name from public.profiles where id = $1', [
        michael,
      ]);
      assert.deepEqual(rows, [{ display_name: 'Michael' }]);
      for (const column of ['gcash_number', 'maya_number', '*']) {
        await assert.rejects(
          db.query(`select ${column} from public.profiles where id = $1`, [michael]),
          /permission denied/,
        );
      }
    });
  });

  it('you can read your own wallet numbers through get_my_profile only', async () => {
    await asUser(db, michael, async () => {
      const { rows } = await db.query('select * from public.get_my_profile()');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, michael);
      assert.equal(rows[0].gcash_number, '09171234567');
      await assert.rejects(
        db.query('select gcash_number from public.profiles where id = $1', [michael]),
        /permission denied/,
      );
    });
    await asUser(db, null, async () => {
      assert.equal((await db.query('select * from public.get_my_profile()')).rows.length, 0);
    });
  });

  it('you can still update your own wallet numbers', async () => {
    await asUser(db, juan, async () => {
      const result = await db.query(
        `update public.profiles set maya_number = '09181234567' where id = $1`,
        [juan],
      );
      assert.equal(result.affectedRows, 1);
      const { rows } = await db.query('select maya_number from public.get_my_profile()');
      assert.equal(rows[0].maya_number, '09181234567');
    });
  });

  it('strangers cannot see a profile at all', async () => {
    for (const user of [bea, carlo]) {
      await asUser(db, user, async () => {
        assert.equal(await count('select 1 from public.profiles where id = $1', [michael]), 0);
        // They still see their own.
        assert.equal(await count('select 1 from public.profiles'), 1);
      });
    }
  });

  it('you can edit only your own profile', async () => {
    await asUser(db, juan, async () => {
      await affectsNothing(
        db.query(`update public.profiles set display_name = 'Hacked' where id = $1`, [michael]),
      );
      const own = await db.query(`update public.profiles set display_name = 'Juan' where id = $1`, [
        juan,
      ]);
      assert.equal(own.affectedRows, 1);
    });
    const { rows } = await db.query('select display_name from public.profiles where id = $1', [
      michael,
    ]);
    assert.equal(rows[0].display_name, 'Michael');
  });

  it('you cannot create a profile for another user', async () => {
    // RLS rejects the row before the foreign key to auth.users is even considered.
    await asUser(db, carlo, () =>
      denied(
        db.query(
          `insert into public.profiles (id, display_name) values (gen_random_uuid(), 'Puppet')`,
        ),
      ),
    );
  });
});

describe('membership', () => {
  it('an outsider cannot add themselves or anyone else to a group', async () => {
    await asUser(db, bea, async () => {
      await denied(
        db.query('insert into public.group_members (group_id, user_id) values ($1, $2)', [
          boracay,
          bea,
        ]),
      );
      await denied(
        db.query('insert into public.group_members (group_id, user_id) values ($1, $2)', [
          boracay,
          carlo,
        ]),
      );
    });
  });

  it('a member cannot remove another member, but can leave', async () => {
    const temp = await asUser(db, michael, async () => {
      const { rows } = await db.query(
        `insert into public.groups (name) values ('Leave test') returning id`,
      );
      return rows[0].id;
    });
    await joinGroup(db, temp, michael, juan);
    await asUser(db, juan, async () => {
      await affectsNothing(
        db.query('delete from public.group_members where group_id = $1 and user_id = $2', [
          temp,
          michael,
        ]),
      );
      const left = await db.query(
        'delete from public.group_members where group_id = $1 and user_id = $2',
        [temp, juan],
      );
      assert.equal(left.affectedRows, 1);
      // Having left, the group is no longer visible.
      assert.equal(await count('select 1 from public.groups where id = $1', [temp]), 0);
    });
  });

  it('only the creator can rename a group, and nobody can delete one', async () => {
    await asUser(db, juan, async () => {
      await affectsNothing(
        db.query(`update public.groups set name = 'Renamed' where id = $1`, [boracay]),
      );
      await affectsNothing(db.query('delete from public.groups where id = $1', [boracay]));
    });
    await asUser(db, michael, async () => {
      const renamed = await db.query(
        `update public.groups set name = 'Boracay 2026 🏝️' where id = $1`,
        [boracay],
      );
      assert.equal(renamed.affectedRows, 1);
      await affectsNothing(db.query('delete from public.groups where id = $1', [boracay]));
    });
  });
});

describe('expenses', () => {
  it('an outsider cannot add an expense to a group', async () => {
    await asUser(db, bea, async () => {
      await denied(insertExpense(boracay, bea));
      await denied(insertExpense(boracay, michael));
    });
  });

  it('a member cannot record an expense as someone else or paid by a non-member', async () => {
    await asUser(db, juan, async () => {
      await denied(insertExpense(boracay, juan, { createdBy: michael }));
      await denied(insertExpense(boracay, bea));
    });
  });

  it('a member cannot modify or delete another member’s expense', async () => {
    await asUser(db, juan, async () => {
      await affectsNothing(
        db.query('update public.expenses set amount = 1 where id = $1', [dinner]),
      );
      await affectsNothing(db.query('delete from public.expenses where id = $1', [dinner]));
      await affectsNothing(
        db.query('update public.expense_splits set amount_owed = 0 where expense_id = $1', [
          dinner,
        ]),
      );
      await affectsNothing(
        db.query('delete from public.expense_splits where expense_id = $1', [dinner]),
      );
    });
    const { rows } = await db.query('select amount::text from public.expenses where id = $1', [
      dinner,
    ]);
    assert.equal(rows[0].amount, '2400.00');
  });

  it('an outsider cannot modify or delete an expense in a group they are not in', async () => {
    await asUser(db, michael, async () => {
      await affectsNothing(
        db.query('update public.expenses set amount = 1 where id = $1', [beaExpense]),
      );
      await affectsNothing(db.query('delete from public.expenses where id = $1', [beaExpense]));
      await denied(insertSplit(beaExpense, michael));
    });
  });

  it('only the expense’s creator can add splits, and only for members', async () => {
    await asUser(db, michael, () =>
      denied(
        insertExpenseWithSplits(db, { group_id: boracay, amount: 600, paid_by: juan }, [
          [bea, 600],
        ]),
      ),
    );
    await asUser(db, ana, () => denied(insertSplit(dinner, ana)));
  });

  it('the creator can delete their own expense, taking its splits with it', async () => {
    const expense = await asUser(db, juan, async () => {
      const id = await insertExpenseWithSplits(
        db,
        { group_id: boracay, amount: 600, paid_by: juan },
        [[ana, 600]],
      );
      const deleted = await db.query('delete from public.expenses where id = $1', [id]);
      assert.equal(deleted.affectedRows, 1);
      return id;
    });
    const { rows } = await db.query('select 1 from public.expense_splits where expense_id = $1', [
      expense,
    ]);
    assert.equal(rows.length, 0);
  });
});

describe('settlements', () => {
  it('an outsider cannot record a settlement in a group', async () => {
    await asUser(db, bea, async () => {
      await denied(insertSettlement(boracay, juan, michael));
      await denied(insertSettlement(boracay, bea, michael));
    });
  });

  it('a member cannot record a payment between two other people', async () => {
    await asUser(db, ana, () => denied(insertSettlement(boracay, juan, michael)));
  });

  it('a payment to or from a non-member is rejected', async () => {
    await asUser(db, juan, () => denied(insertSettlement(boracay, juan, bea)));
  });

  it('payer or payee can record a payment; nobody can change it or remove someone else’s', async () => {
    await asUser(db, michael, () => insertSettlement(boracay, juan, michael, 100));
    for (const user of [michael, juan, ana]) {
      await asUser(db, user, () =>
        affectsNothing(db.query('update public.settlements set amount = 1')),
      );
    }
    // Ana is in the group but not a party to these payments, so she cannot remove them.
    await asUser(db, ana, () => affectsNothing(db.query('delete from public.settlements')));
    const { rows } = await db.query('select 1 from public.settlements where group_id = $1', [
      boracay,
    ]);
    assert.equal(rows.length, 2);
  });
});

describe('policy coverage', () => {
  it('every policy is restricted to the authenticated role', async () => {
    const { rows } = await db.query(
      `select policyname, roles::text from pg_policies where schemaname = 'public'`,
    );
    assert.ok(rows.length > 0);
    for (const row of rows) assert.equal(row.roles, '{authenticated}', row.policyname);
  });

  it('helper functions are not executable by anon', async () => {
    await db.exec('set role anon');
    try {
      await assert.rejects(
        db.query('select private.is_group_member($1, $2)', [boracay, michael]),
        /permission denied/,
      );
    } finally {
      await db.exec('reset role');
    }
  });
});
