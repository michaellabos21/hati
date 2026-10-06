import {
  calculateGroupBalances,
  isSettled,
  simplifyDebts,
  sumUserTotals,
  type BalanceExpense,
  type Balances,
  type BalanceSettlement,
} from '@/features/balances/calculations';
import { splitEqually } from '@/features/expenses/splits';

const P = (pesos: number) => pesos * 100;

const equalExpense = (paidBy: string, amount: number, people: string[]): BalanceExpense => ({
  paidBy,
  amount,
  splits: splitEqually(amount, people),
});

const sum = (balances: Balances) => Object.values(balances).reduce((a, b) => a + b, 0);

/** Applies suggested transfers as settlements and returns the resulting balances. */
function settleAll(expenses: BalanceExpense[], settlements: BalanceSettlement[] = []) {
  const transfers = simplifyDebts(calculateGroupBalances(expenses, settlements));
  return calculateGroupBalances(expenses, [...settlements, ...transfers]);
}

describe('calculateGroupBalances', () => {
  it('1. one payer, equal split (the ₱2,400 dinner from the brief)', () => {
    const balances = calculateGroupBalances(
      [equalExpense('michael', P(2400), ['michael', 'juan', 'ana', 'bea'])],
      [],
    );
    expect(balances).toEqual({ michael: P(1800), juan: -P(600), ana: -P(600), bea: -P(600) });
  });

  it('2. multiple payers', () => {
    const people = ['michael', 'juan', 'ana', 'bea'];
    const balances = calculateGroupBalances(
      [
        equalExpense('michael', P(2400), people),
        equalExpense('ana', P(800), people),
        equalExpense('michael', P(5000), people),
      ],
      [],
    );
    // Each person's share is 600 + 200 + 1250 = 2050.
    expect(balances).toEqual({
      michael: P(7400 - 2050),
      ana: P(800 - 2050),
      juan: -P(2050),
      bea: -P(2050),
    });
    expect(sum(balances)).toBe(0);
  });

  it('3. exact split, including a payer who is not a participant', () => {
    const balances = calculateGroupBalances(
      [
        {
          paidBy: 'michael',
          amount: P(1000),
          splits: [
            { userId: 'juan', amount: P(700) },
            { userId: 'ana', amount: P(300) },
          ],
        },
      ],
      [],
    );
    expect(balances).toEqual({ michael: P(1000), juan: -P(700), ana: -P(300) });
  });

  it('4. partial settlement reduces the debt by exactly the amount paid', () => {
    const expenses = [equalExpense('michael', P(2400), ['michael', 'juan', 'ana', 'bea'])];
    const balances = calculateGroupBalances(expenses, [
      { from: 'juan', to: 'michael', amount: P(250) },
    ]);
    expect(balances.juan).toBe(-P(350));
    expect(balances.michael).toBe(P(1550));
    expect(sum(balances)).toBe(0);
  });

  it('5. fully settled group', () => {
    const expenses = [equalExpense('michael', P(2400), ['michael', 'juan', 'ana', 'bea'])];
    const balances = calculateGroupBalances(expenses, [
      { from: 'juan', to: 'michael', amount: P(600) },
      { from: 'ana', to: 'michael', amount: P(600) },
      { from: 'bea', to: 'michael', amount: P(600) },
    ]);
    expect(isSettled(balances)).toBe(true);
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it('lists members with no activity at zero', () => {
    expect(calculateGroupBalances([], [], ['a', 'b'])).toEqual({ a: 0, b: 0 });
  });

  it('overpaying flips who owes whom', () => {
    const expenses = [equalExpense('michael', P(200), ['michael', 'juan'])];
    const balances = calculateGroupBalances(expenses, [
      { from: 'juan', to: 'michael', amount: P(150) },
    ]);
    expect(balances).toEqual({ michael: -P(50), juan: P(50) });
  });
});

describe('simplifyDebts', () => {
  it('matches the example in the brief', () => {
    expect(simplifyDebts({ michael: P(1000), juan: -P(600), ana: -P(400) })).toEqual([
      { from: 'juan', to: 'michael', amount: P(600) },
      { from: 'ana', to: 'michael', amount: P(400) },
    ]);
  });

  it('6. multiple debtors and creditors: settles everyone in at most n-1 payments', () => {
    const balances = { a: P(700), b: P(300), c: -P(500), d: -P(400), e: -P(100) };
    const transfers = simplifyDebts(balances);
    expect(transfers.length).toBeLessThanOrEqual(4);
    expect(transfers.every((t) => t.amount > 0)).toBe(true);

    const after = { ...balances } as Balances;
    for (const t of transfers) {
      after[t.from] += t.amount;
      after[t.to] -= t.amount;
    }
    expect(isSettled(after)).toBe(true);
  });

  it('removes the middleman: A owes B and B owes C the same amount', () => {
    const balances = calculateGroupBalances(
      [
        { paidBy: 'b', amount: P(100), splits: [{ userId: 'a', amount: P(100) }] },
        { paidBy: 'c', amount: P(100), splits: [{ userId: 'b', amount: P(100) }] },
      ],
      [],
    );
    expect(simplifyDebts(balances)).toEqual([{ from: 'a', to: 'c', amount: P(100) }]);
  });

  it('7. rounding: ₱100 between three people still settles to exactly zero', () => {
    const expenses = [equalExpense('a', P(100), ['a', 'b', 'c'])];
    const balances = calculateGroupBalances(expenses, []);
    expect(balances).toEqual({ a: 6666, b: -3333, c: -3333 });
    expect(sum(balances)).toBe(0);
    expect(isSettled(settleAll(expenses))).toBe(true);
  });

  it('7b. rounding: many awkward amounts never create or lose a centavo', () => {
    const people = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const expenses = [1, 10, 33, 100, 999, 1001, 33333, 99999, 1234567].map((amount, i) =>
      equalExpense(people[i % people.length], amount, people.slice(0, 2 + (i % 6))),
    );
    const balances = calculateGroupBalances(expenses, []);
    expect(sum(balances)).toBe(0);
    expect(Object.values(balances).every(Number.isInteger)).toBe(true);
    expect(isSettled(settleAll(expenses))).toBe(true);
  });

  it('is deterministic when amounts tie', () => {
    const balances = { z: P(100), a: P(100), m: -P(100), b: -P(100) };
    expect(simplifyDebts(balances)).toEqual(simplifyDebts({ ...balances }));
    expect(simplifyDebts(balances)[0]).toEqual({ from: 'b', to: 'a', amount: P(100) });
  });
});

describe('sumUserTotals', () => {
  it('adds up what a user owes and is owed across groups', () => {
    const totals = sumUserTotals('me', [
      { me: P(850), other: -P(850) },
      { me: -P(350), other: P(350) },
      { other: 0 },
    ]);
    expect(totals).toEqual({ owed: P(850), owes: P(350), net: P(500) });
  });
});
