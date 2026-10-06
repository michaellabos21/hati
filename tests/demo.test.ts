import { parseLedger } from '@/features/ledger/schema';
import { selectDashboard, selectGroup, selectMyDebts } from '@/features/ledger/selectors';
import { createDemoClient } from '@/lib/demo/demoClient';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo/sampleData';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const ME = 'demo-michael';

async function signedIn(email = DEMO_EMAIL) {
  const client = createDemoClient();
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  expect(error).toBeNull();
  return client;
}

async function loadLedger(client: ReturnType<typeof createDemoClient>) {
  const [groups, expenses, settlements] = await Promise.all([
    client.from('groups').select('*'),
    client.from('expenses').select('*'),
    client.from('settlements').select('*'),
  ]);
  return parseLedger({
    groups: groups.data,
    expenses: expenses.data,
    settlements: settlements.data,
  });
}

describe('demo mode sample data', () => {
  it('rejects a wrong password and unknown accounts', async () => {
    const client = createDemoClient();
    const wrong = await client.auth.signInWithPassword({ email: DEMO_EMAIL, password: 'nope' });
    expect(wrong.error?.message).toMatch(/Invalid login/);
    const nobody = await client.auth.signInWithPassword({
      email: 'x@x.co',
      password: DEMO_PASSWORD,
    });
    expect(nobody.error?.message).toMatch(/Invalid login/);
  });

  it('returns nothing before sign-in', async () => {
    const { error } = await createDemoClient().from('groups').select('*');
    expect(error).not.toBeNull();
  });

  it('loads the Boracay 2026 scenario in the shape the app expects', async () => {
    const ledger = await loadLedger(await signedIn());
    const boracay = selectGroup(ledger, 'demo-boracay', ME);

    expect(boracay?.group.members.map((m) => m.displayName)).toEqual([
      'Ana',
      'Bea',
      'Carlo',
      'Juan',
      'Michael',
    ]);
    expect(boracay?.expenses.map((e) => [e.description, e.amount])).toEqual([
      ['Dinner', 240000],
      ['Hotel', 500000],
      ['Grab', 80000],
      ['Beach fees', 100000],
    ]);
    // ₱9,200 over five people is ₱1,840 each. Michael paid ₱7,400 and Carlo has repaid ₱1,000.
    expect(boracay?.balances).toEqual({
      'demo-michael': 740000 - 184000 - 100000,
      'demo-ana': 80000 - 184000,
      'demo-bea': 100000 - 184000,
      'demo-juan': -184000,
      'demo-carlo': -184000 + 100000,
    });
    expect(Object.values(boracay?.balances ?? {}).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('shows money going both ways on the dashboard', async () => {
    const ledger = await loadLedger(await signedIn());
    const { totals } = selectDashboard(ledger, ME);
    expect(totals.owed).toBe(456000);
    expect(totals.owes).toBe(162538);
    expect(selectMyDebts(ledger, ME).some((debt) => debt.amount < 0)).toBe(true);
  });

  it('scopes data to the signed-in user’s groups', async () => {
    const outsider = await loadLedger(await signedIn('dani@example.com'));
    expect(outsider).toEqual({ groups: [], expenses: [], settlements: [] });

    const carlo = await loadLedger(await signedIn('carlo@example.com'));
    expect(carlo.groups.map((g) => g.id)).toEqual(['demo-boracay']);
  });
});

describe('demo mode follows the database rules', () => {
  const expenseArgs = (splits: [string, string][], amount = '300.00') => ({
    p_group_id: 'demo-boracay',
    p_description: 'Halo-halo',
    p_amount: amount,
    p_paid_by: ME,
    p_split_method: 'exact',
    p_splits: splits.map(([user_id, amount_owed]) => ({ user_id, amount_owed })),
  });

  it('adds an expense and updates balances', async () => {
    const client = await signedIn();
    const before = selectGroup(await loadLedger(client), 'demo-boracay', ME)?.balances[ME] ?? 0;
    const { error } = await client.rpc(
      'create_expense',
      expenseArgs([
        [ME, '100.00'],
        ['demo-juan', '200.00'],
      ]),
    );
    expect(error).toBeNull();
    const after = selectGroup(await loadLedger(client), 'demo-boracay', ME)?.balances[ME] ?? 0;
    expect(after - before).toBe(20000);
  });

  it('rejects splits that do not add up, or that include a non-member', async () => {
    const client = await signedIn();
    const short = await client.rpc('create_expense', expenseArgs([['demo-juan', '299.99']]));
    expect(short.error?.message).toMatch(/Splits total/);
    const stranger = await client.rpc('create_expense', expenseArgs([['demo-dani', '300.00']]));
    expect(stranger.error?.message).toMatch(/row-level security/);
  });

  it('blocks leaving a group with a balance, and payments between other people', async () => {
    const client = await signedIn();
    const leave = await client
      .from('group_members')
      .delete()
      .eq('group_id', 'demo-boracay')
      .eq('user_id', ME);
    expect(leave.error?.message).toMatch(/Settle up before leaving/);

    const thirdParty = await client.from('settlements').insert({
      group_id: 'demo-boracay',
      from_user: 'demo-juan',
      to_user: 'demo-ana',
      amount: '50.00',
    });
    expect(thirdParty.error?.message).toMatch(/row-level security/);
  });

  it('only deletes expenses the signed-in user recorded', async () => {
    const client = await signedIn();
    const ledger = await loadLedger(client);
    const grab = ledger.expenses.find((e) => e.description === 'Grab');
    const dinner = ledger.expenses.find((e) => e.description === 'Dinner');

    const notMine = await client.from('expenses').delete().eq('id', grab?.id).select('id');
    expect(notMine.data).toEqual([]);
    const mine = await client.from('expenses').delete().eq('id', dinner?.id).select('id');
    expect(mine.data).toEqual([{ id: dinner?.id }]);
  });

  it('finds people by exact email only', async () => {
    const client = await signedIn();
    const found = await client.rpc('find_user_by_email', { search_email: ' Dani@Example.com ' });
    expect(found.data).toEqual([{ id: 'demo-dani', display_name: 'Dani' }]);
    const partial = await client.rpc('find_user_by_email', { search_email: 'dani' });
    expect(partial.data).toEqual([]);
  });
});

describe('demo mode keeps wallet numbers private', () => {
  it('returns them only for the signed-in user', async () => {
    const client = await signedIn();
    const mine = await client.rpc('get_my_profile');
    expect(mine.data).toEqual([
      { id: ME, display_name: 'Michael', gcash_number: '09171234567', maya_number: null },
    ]);

    const groups = await client.from('groups').select('*');
    expect(JSON.stringify(groups.data)).not.toMatch(/gcash_number|maya_number|0918|0919/);
    const direct = await client.from('profiles').select('*');
    expect(direct.error).not.toBeNull();
  });
});
