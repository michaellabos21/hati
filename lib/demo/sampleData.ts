// Sample data for demo mode: the Boracay 2026 scenario from MVP_PLAN.md section 19, plus a
// second group so the dashboard shows money going both ways. Amounts are pesos, as the database
// would return them.

export type DemoUser = {
  id: string;
  email: string;
  display_name: string;
  gcash_number: string | null;
  maya_number: string | null;
};

export type DemoRow = Record<string, unknown>;

export type DemoTables = {
  groups: DemoRow[];
  group_members: DemoRow[];
  expenses: DemoRow[];
  expense_splits: DemoRow[];
  settlements: DemoRow[];
};

/** Every demo account uses this password. */
export const DEMO_PASSWORD = 'password';
export const DEMO_EMAIL = 'michael@example.com';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const HOUR = 60;
const DAY = 24 * HOUR;

export function createSampleUsers(): DemoUser[] {
  return [
    {
      id: 'demo-michael',
      email: DEMO_EMAIL,
      display_name: 'Michael',
      gcash_number: '09171234567',
      maya_number: null,
    },
    {
      id: 'demo-juan',
      email: 'juan@example.com',
      display_name: 'Juan',
      gcash_number: '09181234567',
      maya_number: null,
    },
    {
      id: 'demo-ana',
      email: 'ana@example.com',
      display_name: 'Ana',
      gcash_number: null,
      maya_number: '09191234567',
    },
    {
      id: 'demo-bea',
      email: 'bea@example.com',
      display_name: 'Bea',
      gcash_number: null,
      maya_number: null,
    },
    {
      id: 'demo-carlo',
      email: 'carlo@example.com',
      display_name: 'Carlo',
      gcash_number: null,
      maya_number: null,
    },
    // Has an account but is in no group yet, so "Add member" has someone to find.
    {
      id: 'demo-dani',
      email: 'dani@example.com',
      display_name: 'Dani',
      gcash_number: null,
      maya_number: null,
    },
  ];
}

export function createSampleTables(): DemoTables {
  const tables: DemoTables = {
    groups: [
      {
        id: 'demo-boracay',
        name: 'Boracay 2026',
        description: 'Summer trip with the barkada',
        created_by: 'demo-michael',
        created_at: minutesAgo(6 * DAY),
      },
      {
        id: 'demo-apartment',
        name: 'Apartment',
        description: 'Rent and bills',
        created_by: 'demo-juan',
        created_at: minutesAgo(40 * DAY),
      },
    ],
    group_members: [],
    expenses: [],
    expense_splits: [],
    settlements: [
      {
        id: 'demo-settlement-1',
        group_id: 'demo-boracay',
        from_user: 'demo-carlo',
        to_user: 'demo-michael',
        amount: 1000,
        created_by: 'demo-carlo',
        created_at: minutesAgo(3 * HOUR),
      },
    ],
  };

  const barkada = ['demo-michael', 'demo-juan', 'demo-ana', 'demo-bea', 'demo-carlo'];
  const flatmates = ['demo-michael', 'demo-juan'];
  for (const user_id of barkada) tables.group_members.push({ group_id: 'demo-boracay', user_id });
  for (const user_id of flatmates)
    tables.group_members.push({ group_id: 'demo-apartment', user_id });

  let next = 1;
  const addEqualExpense = (
    group_id: string,
    description: string,
    pesos: number,
    paid_by: string,
    people: string[],
    created_at: string,
  ) => {
    const id = `demo-expense-${next++}`;
    tables.expenses.push({
      id,
      group_id,
      description,
      amount: pesos,
      paid_by,
      created_by: paid_by,
      split_method: 'equal',
      created_at,
    });
    const centavos = Math.round(pesos * 100);
    const base = Math.floor(centavos / people.length);
    const extra = centavos - base * people.length;
    people.forEach((user_id, index) => {
      tables.expense_splits.push({
        expense_id: id,
        user_id,
        amount_owed: (base + (index < extra ? 1 : 0)) / 100,
      });
    });
  };

  addEqualExpense('demo-boracay', 'Dinner', 2400, 'demo-michael', barkada, minutesAgo(25));
  addEqualExpense('demo-boracay', 'Hotel', 5000, 'demo-michael', barkada, minutesAgo(1 * DAY));
  addEqualExpense('demo-boracay', 'Grab', 800, 'demo-ana', barkada, minutesAgo(2 * DAY));
  addEqualExpense('demo-boracay', 'Beach fees', 1000, 'demo-bea', barkada, minutesAgo(3 * DAY));
  addEqualExpense(
    'demo-apartment',
    'Meralco bill',
    3250.75,
    'demo-juan',
    flatmates,
    minutesAgo(5 * DAY),
  );

  return tables;
}
