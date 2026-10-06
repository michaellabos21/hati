import {
  splitEqually,
  sumSplits,
  validateExpense,
  type ExpenseDraft,
} from '@/features/expenses/splits';

const MEMBERS = ['michael', 'juan', 'ana', 'bea'];

describe('splitEqually', () => {
  it('splits ₱2,400 four ways into ₱600 each', () => {
    expect(splitEqually(240000, MEMBERS).map((s) => s.amount)).toEqual([
      60000, 60000, 60000, 60000,
    ]);
  });

  it('hands leftover centavos to the first participants', () => {
    expect(splitEqually(1000, ['a', 'b', 'c'])).toEqual([
      { userId: 'a', amount: 334 },
      { userId: 'b', amount: 333 },
      { userId: 'c', amount: 333 },
    ]);
    expect(splitEqually(1, ['a', 'b', 'c']).map((s) => s.amount)).toEqual([1, 0, 0]);
  });

  it('always adds up to the total, with shares within one centavo of each other', () => {
    for (const total of [1, 99, 100, 101, 12345, 240000, 999999999]) {
      for (let people = 1; people <= 12; people += 1) {
        const ids = Array.from({ length: people }, (_, i) => `u${i}`);
        const splits = splitEqually(total, ids);
        const amounts = splits.map((s) => s.amount);
        expect(sumSplits(splits)).toBe(total);
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('returns nothing when there is no one to split with', () => {
    expect(splitEqually(1000, [])).toEqual([]);
  });
});

describe('validateExpense', () => {
  const valid: ExpenseDraft = {
    description: 'Dinner',
    amount: 240000,
    paidBy: 'michael',
    memberIds: MEMBERS,
    splits: splitEqually(240000, MEMBERS),
  };

  it('accepts a valid equal split', () => {
    expect(validateExpense(valid)).toEqual({});
  });

  it('accepts an exact split that adds up', () => {
    const splits = [
      { userId: 'michael', amount: 100000 },
      { userId: 'juan', amount: 140000 },
    ];
    expect(validateExpense({ ...valid, splits })).toEqual({});
  });

  it('rejects an exact split that does not add up', () => {
    const splits = [
      { userId: 'michael', amount: 100000 },
      { userId: 'juan', amount: 139999 },
    ];
    expect(validateExpense({ ...valid, splits }).splits).toMatch(/add up/);
  });

  it('requires a description, a positive amount, a payer and a participant', () => {
    expect(validateExpense({ ...valid, description: '  ' }).description).toBeDefined();
    expect(validateExpense({ ...valid, amount: null }).amount).toBeDefined();
    expect(validateExpense({ ...valid, amount: 0, splits: [] }).amount).toBeDefined();
    expect(validateExpense({ ...valid, paidBy: null }).paidBy).toBeDefined();
    expect(validateExpense({ ...valid, splits: [] }).splits).toMatch(/at least one/);
  });

  it('rejects payers and participants outside the group, and negative shares', () => {
    expect(validateExpense({ ...valid, paidBy: 'stranger' }).paidBy).toBeDefined();
    expect(
      validateExpense({ ...valid, splits: [{ userId: 'stranger', amount: 240000 }] }).splits,
    ).toMatch(/group member/);
    expect(
      validateExpense({
        ...valid,
        splits: [
          { userId: 'michael', amount: 250000 },
          { userId: 'juan', amount: -10000 },
        ],
      }).splits,
    ).toMatch(/valid amount/);
  });
});
