// Seeds a real Supabase project with the Boracay 2026 scenario and checks it end to end:
// the Definition of Done flow, the balance maths, and Row Level Security from an outsider's
// point of view. Everything except creating/removing the test accounts goes through the same
// public API and policies the app uses.
//
//   npm run seed
//
// Needs in .env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY (used only here, to create confirmed test accounts; it must never
// get an EXPO_PUBLIC_ prefix). Optional: SEED_PASSWORD for the test accounts.
//
// Safe to re-run: it removes its own previous accounts and groups first.
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import {
  calculateGroupBalances,
  isSettled,
  simplifyDebts,
} from '../features/balances/calculations.ts';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !anonKey || !serviceKey) {
  console.error(
    '✗ Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.',
  );
  process.exit(1);
}

const password = process.env.SEED_PASSWORD?.trim() || randomBytes(9).toString('base64url');
const NAMES = ['Michael', 'Juan', 'Ana', 'Bea', 'Carlo', 'Dayo'];
const emailFor = (name) => `seed-${name.toLowerCase()}@hati.test`;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, options);

const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
};
const step = (message) => console.log(`✓ ${message}`);

// --- Clean up a previous run --------------------------------------------------------------
const existing = must(
  await admin.auth.admin.listUsers({ perPage: 1000 }),
  'list users',
).users.filter((user) => NAMES.some((name) => user.email === emailFor(name)));
if (existing.length > 0) {
  const ids = existing.map((user) => user.id);
  must(await admin.from('groups').delete().in('created_by', ids), 'remove old seed groups');
  for (const id of ids) must(await admin.auth.admin.deleteUser(id), 'remove old seed user');
  step(`Removed ${existing.length} accounts from a previous run`);
}

// --- Accounts -----------------------------------------------------------------------------
const clients = {};
const ids = {};
for (const name of NAMES) {
  const created = must(
    await admin.auth.admin.createUser({
      email: emailFor(name),
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    }),
    `create ${name}`,
  );
  ids[name] = created.user.id;
  clients[name] = createClient(url, anonKey, options);
  must(
    await clients[name].auth.signInWithPassword({ email: emailFor(name), password }),
    `sign in ${name}`,
  );
}
step(`Created and signed in ${NAMES.length} test accounts (profiles made by the database trigger)`);

const profile = must(
  await clients.Michael.from('profiles').select('display_name').eq('id', ids.Michael).single(),
  'read own profile',
);
assert.equal(profile.display_name, 'Michael');

// --- Group and members --------------------------------------------------------------------
const group = must(
  await clients.Michael.from('groups').insert({ name: 'Boracay 2026' }).select('id').single(),
  'create group',
).id;
const barkada = ['Michael', 'Juan', 'Ana', 'Bea', 'Carlo'];
for (const name of barkada.slice(1)) {
  const found = must(
    await clients.Michael.rpc('find_user_by_email', { search_email: emailFor(name) }),
    `find ${name}`,
  );
  assert.equal(found.length, 1, `find_user_by_email should find ${name}`);
  must(
    await clients.Michael.from('group_members').insert({ group_id: group, user_id: found[0].id }),
    `add ${name}`,
  );
}
step('Michael created "Boracay 2026" and added four members by email');

// --- Expenses (several payers) ------------------------------------------------------------
const equalSplits = (pesos, people) => {
  const total = Math.round(pesos * 100);
  const base = Math.floor(total / people.length);
  const extra = total - base * people.length;
  return people.map((name, index) => ({
    user_id: ids[name],
    amount_owed: ((base + (index < extra ? 1 : 0)) / 100).toFixed(2),
  }));
};
const addExpense = async (payer, description, pesos) =>
  must(
    await clients[payer].rpc('create_expense', {
      p_group_id: group,
      p_description: description,
      p_amount: pesos.toFixed(2),
      p_paid_by: ids[payer],
      p_split_method: 'equal',
      p_splits: equalSplits(pesos, barkada),
    }),
    `add ${description}`,
  );
const dinner = await addExpense('Michael', 'Dinner', 2400);
await addExpense('Michael', 'Hotel', 5000);
await addExpense('Ana', 'Grab', 800);
await addExpense('Bea', 'Beach fees', 1000);
step('Added Dinner ₱2,400, Hotel ₱5,000, Grab ₱800 and Beach fees ₱1,000');

// --- Balances, as any member sees them ----------------------------------------------------
const centavos = (numeric) => Math.round(Number(numeric) * 100);
async function balancesAs(name) {
  const expenses = must(
    await clients[name]
      .from('expenses')
      .select('paid_by, amount, expense_splits(user_id, amount_owed)')
      .eq('group_id', group),
    'read expenses',
  );
  const settlements = must(
    await clients[name]
      .from('settlements')
      .select('from_user, to_user, amount')
      .eq('group_id', group),
    'read settlements',
  );
  return calculateGroupBalances(
    expenses.map((e) => ({
      paidBy: e.paid_by,
      amount: centavos(e.amount),
      splits: e.expense_splits.map((s) => ({ userId: s.user_id, amount: centavos(s.amount_owed) })),
    })),
    settlements.map((s) => ({ from: s.from_user, to: s.to_user, amount: centavos(s.amount) })),
  );
}

// ₱9,200 over five people is ₱1,840 each.
assert.deepEqual(await balancesAs('Carlo'), {
  [ids.Michael]: 740000 - 184000,
  [ids.Ana]: 80000 - 184000,
  [ids.Bea]: 100000 - 184000,
  [ids.Juan]: -184000,
  [ids.Carlo]: -184000,
});
step('Balances are exact: everyone’s share is ₱1,840');

// --- Security -----------------------------------------------------------------------------
const outsider = clients.Dayo;
for (const table of ['groups', 'group_members', 'expenses', 'expense_splits', 'settlements']) {
  assert.equal(must(await outsider.from(table).select('*'), `outsider reads ${table}`).length, 0);
}
assert.equal(
  must(await outsider.from('profiles').select('id'), 'outsider reads profiles').length,
  1,
  'an outsider should see only their own profile',
);
const forged = await outsider.rpc('create_expense', {
  p_group_id: group,
  p_description: 'Forged',
  p_amount: '100.00',
  p_paid_by: ids.Dayo,
  p_split_method: 'equal',
  p_splits: [{ user_id: ids.Dayo, amount_owed: '100.00' }],
});
assert.ok(forged.error, 'an outsider must not be able to add an expense');
const joined = await outsider.from('group_members').insert({ group_id: group, user_id: ids.Dayo });
assert.ok(joined.error, 'an outsider must not be able to join a group');
step('An outsider can read nothing in the group, cannot add an expense and cannot join');

const stolen = must(
  await clients.Juan.from('expenses').delete().eq('id', dinner).select('id'),
  'Juan tries to delete Michael’s expense',
);
assert.equal(stolen.length, 0, 'a member must not delete another member’s expense');
const edited = must(
  await clients.Juan.from('expenses').update({ amount: 1 }).eq('id', dinner).select('id'),
  'Juan tries to edit Michael’s expense',
);
assert.equal(edited.length, 0, 'a member must not edit another member’s expense');
const unbalanced = await clients.Juan.rpc('create_expense', {
  p_group_id: group,
  p_description: 'Does not add up',
  p_amount: '100.00',
  p_paid_by: ids.Juan,
  p_split_method: 'exact',
  p_splits: [{ user_id: ids.Juan, amount_owed: '99.00' }],
});
assert.ok(unbalanced.error, 'splits that do not total the expense must be rejected');
const thirdParty = await clients.Ana.from('settlements').insert({
  group_id: group,
  from_user: ids.Juan,
  to_user: ids.Michael,
  amount: '10.00',
});
assert.ok(thirdParty.error, 'only the payer or payee may record a payment');
const leave = await clients.Juan.from('group_members')
  .delete()
  .eq('group_id', group)
  .eq('user_id', ids.Juan);
assert.ok(leave.error, 'a member with a balance must not be able to leave');
step(
  'Members cannot edit or delete each other’s expenses, unbalance a split, or leave owing money',
);

// --- Settlement ---------------------------------------------------------------------------
must(
  await clients.Carlo.from('settlements').insert({
    group_id: group,
    from_user: ids.Carlo,
    to_user: ids.Michael,
    amount: '1000.00',
  }),
  'Carlo pays Michael',
);
const after = await balancesAs('Michael');
assert.equal(after[ids.Carlo], -84000);
assert.equal(after[ids.Michael], 740000 - 184000 - 100000);
assert.equal(isSettled(after), false);
assert.ok(simplifyDebts(after).every((transfer) => transfer.to === ids.Michael));
step('Carlo recorded a ₱1,000 payment and the balances updated');

console.log('\nAll checks passed. The seed data is left in place so you can open the app:');
console.log(`  Accounts: ${barkada.map(emailFor).join(', ')}`);
console.log(
  process.env.SEED_PASSWORD
    ? '  Password: the SEED_PASSWORD from your .env'
    : `  Password (generated for this run): ${password}`,
);
