// The balance engine. Pure functions over integer centavos; no imports, no I/O.

export type BalanceExpense = {
  paidBy: string;
  amount: number;
  splits: readonly { userId: string; amount: number }[];
};

export type BalanceSettlement = {
  from: string;
  to: string;
  amount: number;
};

/** userId -> net centavos. Positive: the user is owed money. Negative: the user owes money. */
export type Balances = Record<string, number>;

export type Transfer = { from: string; to: string; amount: number };

/**
 * Net balance for everyone involved in a group.
 *
 *   net = paid for expenses - share of expenses + settlements sent - settlements received
 *
 * Paying a settlement moves the payer toward zero from below, and the receiver toward zero from
 * above. (MVP_PLAN.md section 8 writes the settlement signs the other way round, which would
 * double a debt each time it was paid; this is the corrected form.)
 *
 * `memberIds` seeds the result so members with no activity still appear with a zero balance.
 */
export function calculateGroupBalances(
  expenses: readonly BalanceExpense[],
  settlements: readonly BalanceSettlement[],
  memberIds: readonly string[] = [],
): Balances {
  const balances: Balances = {};
  const add = (userId: string, amount: number) => {
    balances[userId] = (balances[userId] ?? 0) + amount;
  };

  for (const userId of memberIds) add(userId, 0);

  for (const expense of expenses) {
    add(expense.paidBy, expense.amount);
    for (const split of expense.splits) add(split.userId, -split.amount);
  }

  for (const settlement of settlements) {
    add(settlement.from, settlement.amount);
    add(settlement.to, -settlement.amount);
  }

  return balances;
}

/**
 * Suggests who should pay whom to clear every balance.
 *
 * Greedy matching: the person who owes the most pays the person owed the most, repeatedly. It
 * always preserves each person's net balance and needs at most (people - 1) payments. It does
 * not search for the theoretical minimum number of payments.
 */
export function simplifyDebts(balances: Balances): Transfer[] {
  const byAmountThenId = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || a[0].localeCompare(b[0]);

  const creditors = Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .sort(byAmountThenId);
  const debtors = Object.entries(balances)
    .filter(([, amount]) => amount < 0)
    .map(([userId, amount]): [string, number] => [userId, -amount])
    .sort(byAmountThenId);

  const transfers: Transfer[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(creditors[c][1], debtors[d][1]);
    transfers.push({ from: debtors[d][0], to: creditors[c][0], amount });
    creditors[c][1] -= amount;
    debtors[d][1] -= amount;
    if (creditors[c][1] === 0) c += 1;
    if (debtors[d][1] === 0) d += 1;
  }
  return transfers;
}

export type UserTotals = {
  /** Total the user should pay others. */
  owes: number;
  /** Total others should pay the user. */
  owed: number;
  net: number;
};

/** Sums a user's position across several groups' balances. */
export function sumUserTotals(userId: string, groupBalances: readonly Balances[]): UserTotals {
  let owes = 0;
  let owed = 0;
  for (const balances of groupBalances) {
    const net = balances[userId] ?? 0;
    if (net > 0) owed += net;
    if (net < 0) owes += -net;
  }
  return { owes, owed, net: owed - owes };
}

export function isSettled(balances: Balances): boolean {
  return Object.values(balances).every((amount) => amount === 0);
}
