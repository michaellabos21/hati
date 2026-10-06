import {
  expenseImpact,
  meFirst,
  nameOf,
  selectActivity,
  selectDashboard,
  selectGroup,
  selectMyDebts,
} from '@/features/ledger/selectors';
import type { Expense, Group, Ledger, Member } from '@/types/domain';

const member = (id: string, displayName: string): Member => ({ id, displayName });

const group = (id: string, name: string, members: Member[]): Group => ({
  id,
  name,
  description: null,
  createdBy: members[0].id,
  createdAt: '2026-10-01T00:00:00Z',
  members,
});

const michael = member('michael', 'Michael');
const juan = member('juan', 'Juan');
const ana = member('ana', 'Ana');

const expense = (
  id: string,
  groupId: string,
  paidBy: string,
  amount: number,
  splits: [string, number][],
  createdAt: string,
): Expense => ({
  id,
  groupId,
  description: id,
  amount,
  paidBy,
  createdBy: paidBy,
  splitMethod: 'exact',
  createdAt,
  splits: splits.map(([userId, share]) => ({ userId, amount: share })),
});

// Trip: Michael paid 3000 split three ways, Juan has paid back 400.
// Flat: Juan paid 1000 split with Michael.
const ledger: Ledger = {
  groups: [group('trip', 'Trip', [michael, juan, ana]), group('flat', 'Flat', [michael, juan])],
  expenses: [
    expense(
      'hotel',
      'trip',
      'michael',
      300000,
      [
        ['michael', 100000],
        ['juan', 100000],
        ['ana', 100000],
      ],
      '2026-10-02T10:00:00Z',
    ),
    expense(
      'rent',
      'flat',
      'juan',
      100000,
      [
        ['michael', 50000],
        ['juan', 50000],
      ],
      '2026-10-04T10:00:00Z',
    ),
  ],
  settlements: [
    {
      id: 's1',
      groupId: 'trip',
      from: 'juan',
      to: 'michael',
      amount: 40000,
      createdBy: 'juan',
      createdAt: '2026-10-03T10:00:00Z',
    },
  ],
};

describe('selectGroup', () => {
  it('computes balances, suggested payments and the viewer’s position', () => {
    const view = selectGroup(ledger, 'trip', 'michael');
    expect(view?.balances).toEqual({ michael: 160000, juan: -60000, ana: -100000 });
    expect(view?.transfers).toEqual([
      { from: 'ana', to: 'michael', amount: 100000 },
      { from: 'juan', to: 'michael', amount: 60000 },
    ]);
    expect(view?.mine).toEqual({ owed: 160000, owes: 0, net: 160000 });
  });

  it('returns null for a group the viewer cannot see', () => {
    expect(selectGroup(ledger, 'nope', 'michael')).toBeNull();
  });
});

describe('selectDashboard', () => {
  it('totals what the viewer owes and is owed across groups', () => {
    const dashboard = selectDashboard(ledger, 'michael');
    expect(dashboard.totals).toEqual({ owed: 160000, owes: 50000, net: 110000 });
    expect(dashboard.groups.map((g) => [g.group.id, g.net])).toEqual([
      ['trip', 160000],
      ['flat', -50000],
    ]);
  });

  it('is all zeros for someone with no groups', () => {
    expect(selectDashboard({ groups: [], expenses: [], settlements: [] }, 'x').totals).toEqual({
      owed: 0,
      owes: 0,
      net: 0,
    });
  });
});

describe('selectMyDebts', () => {
  it('lists who owes the viewer and whom the viewer owes, largest first', () => {
    const debts = selectMyDebts(ledger, 'michael').map((d) => [d.group.id, d.personId, d.amount]);
    expect(debts).toEqual([
      ['trip', 'ana', 100000],
      ['trip', 'juan', 60000],
      ['flat', 'juan', -50000],
    ]);
  });

  it('leaves out payments between other people', () => {
    expect(selectMyDebts(ledger, 'ana').map((d) => [d.personId, d.amount])).toEqual([
      ['michael', -100000],
    ]);
  });
});

describe('selectActivity', () => {
  it('merges expenses and settlements, newest first, and honours the limit', () => {
    expect(selectActivity(ledger).map((item) => item.id)).toEqual(['rent', 's1', 'hotel']);
    expect(selectActivity(ledger, 2)).toHaveLength(2);
  });
});

describe('expenseImpact', () => {
  const hotel = ledger.expenses[0];
  it('is positive for the payer, negative for a participant, zero for a bystander', () => {
    expect(expenseImpact(hotel, 'michael')).toBe(200000);
    expect(expenseImpact(hotel, 'juan')).toBe(-100000);
    expect(expenseImpact(hotel, 'stranger')).toBe(0);
  });
});

describe('names and ordering', () => {
  const trip = ledger.groups[0];
  it('says "You" for the viewer and labels people who have left', () => {
    expect(nameOf(trip, 'michael', 'michael')).toBe('You');
    expect(nameOf(trip, 'juan', 'michael')).toBe('Juan');
    expect(nameOf(trip, 'gone', 'michael')).toBe('Former member');
  });

  it('puts the viewer first without reordering anyone else', () => {
    expect(meFirst(trip.members, 'ana').map((m) => m.id)).toEqual(['ana', 'michael', 'juan']);
  });
});
