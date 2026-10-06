// Pure views over the ledger. Screens call these; none of them touch the network.
import {
  calculateGroupBalances,
  simplifyDebts,
  sumUserTotals,
  type Balances,
  type Transfer,
  type UserTotals,
} from '@/features/balances/calculations';
import { FORMER_MEMBER } from '@/features/ledger/schema';
import type { Expense, Group, Ledger, Member, Settlement } from '@/types/domain';

export type GroupView = {
  group: Group;
  expenses: Expense[];
  settlements: Settlement[];
  /** Net balance per person, including anyone who has left but still appears in the records. */
  balances: Balances;
  /** Suggested payments that would settle the group. */
  transfers: Transfer[];
  /** What the viewer should pay and receive under the suggested payments. */
  mine: UserTotals;
};

export function selectGroup(ledger: Ledger, groupId: string, userId: string): GroupView | null {
  const group = ledger.groups.find((candidate) => candidate.id === groupId);
  if (!group) return null;

  const expenses = ledger.expenses.filter((expense) => expense.groupId === groupId);
  const settlements = ledger.settlements.filter((settlement) => settlement.groupId === groupId);
  const balances = calculateGroupBalances(
    expenses,
    settlements,
    group.members.map((member) => member.id),
  );

  return {
    group,
    expenses,
    settlements,
    balances,
    transfers: simplifyDebts(balances),
    mine: sumUserTotals(userId, [balances]),
  };
}

export type GroupSummary = { group: Group; net: number; expenseCount: number };

export type Dashboard = {
  totals: UserTotals;
  groups: GroupSummary[];
};

export function selectDashboard(ledger: Ledger, userId: string): Dashboard {
  const views = ledger.groups
    .map((group) => selectGroup(ledger, group.id, userId))
    .filter((view): view is GroupView => view !== null);

  return {
    totals: sumUserTotals(
      userId,
      views.map((view) => view.balances),
    ),
    groups: views.map((view) => ({
      group: view.group,
      net: view.balances[userId] ?? 0,
      expenseCount: view.expenses.length,
    })),
  };
}

export type Debt = {
  group: Group;
  /** The other person. */
  personId: string;
  /** Positive: they should pay the viewer. Negative: the viewer should pay them. */
  amount: number;
};

/**
 * "Who owes who" for the viewer: every suggested payment they are part of, across all groups,
 * largest first. This is the plain-language answer the dashboard leads with.
 */
export function selectMyDebts(ledger: Ledger, userId: string): Debt[] {
  const debts: Debt[] = [];
  for (const group of ledger.groups) {
    const view = selectGroup(ledger, group.id, userId);
    if (!view) continue;
    for (const transfer of view.transfers) {
      if (transfer.to === userId) {
        debts.push({ group, personId: transfer.from, amount: transfer.amount });
      } else if (transfer.from === userId) {
        debts.push({ group, personId: transfer.to, amount: -transfer.amount });
      }
    }
  }
  return debts.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

export type ActivityItem =
  | { kind: 'expense'; id: string; createdAt: string; group: Group; expense: Expense }
  | { kind: 'settlement'; id: string; createdAt: string; group: Group; settlement: Settlement };

/** Expenses and settlements across every group, newest first. */
export function selectActivity(ledger: Ledger, limit?: number): ActivityItem[] {
  const groups = new Map(ledger.groups.map((group) => [group.id, group]));
  const items: ActivityItem[] = [];

  for (const expense of ledger.expenses) {
    const group = groups.get(expense.groupId);
    if (group) {
      items.push({ kind: 'expense', id: expense.id, createdAt: expense.createdAt, group, expense });
    }
  }
  for (const settlement of ledger.settlements) {
    const group = groups.get(settlement.groupId);
    if (group) {
      items.push({
        kind: 'settlement',
        id: settlement.id,
        createdAt: settlement.createdAt,
        group,
        settlement,
      });
    }
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return limit === undefined ? items : items.slice(0, limit);
}

/** The viewer first, then everyone else in their usual order. */
export function meFirst(members: readonly Member[], userId: string): Member[] {
  return [...members].sort((a, b) => Number(b.id === userId) - Number(a.id === userId));
}

export function findMember(group: Group, userId: string): Member | undefined {
  return group.members.find((member) => member.id === userId);
}

/** A person's name as shown to the viewer: "You", their display name, or a former member. */
export function nameOf(group: Group, userId: string, viewerId: string): string {
  if (userId === viewerId) return 'You';
  return findMember(group, userId)?.displayName ?? FORMER_MEMBER;
}

/**
 * How one expense affects the viewer: positive means they are owed that much for it (they paid
 * for others), negative means it is their share to pay back, zero means they are not involved.
 */
export function expenseImpact(expense: Expense, userId: string): number {
  const paid = expense.paidBy === userId ? expense.amount : 0;
  const share = expense.splits.find((split) => split.userId === userId)?.amount ?? 0;
  return paid - share;
}
