// Pure split logic. All amounts are integer centavos.

export type Split = { userId: string; amount: number };

/** ₱9,999,999.99, comfortably inside the database's numeric(12,2). */
export const MAX_AMOUNT = 999_999_999;

/**
 * Splits a total equally. Any leftover centavos go one each to the first participants in the
 * list, so the shares always add up to the total exactly.
 * Example: 1000 between 3 -> 334, 333, 333.
 */
export function splitEqually(totalCentavos: number, participantIds: readonly string[]): Split[] {
  const count = participantIds.length;
  if (count === 0) return [];
  const base = Math.floor(totalCentavos / count);
  const remainder = totalCentavos - base * count;
  return participantIds.map((userId, index) => ({
    userId,
    amount: base + (index < remainder ? 1 : 0),
  }));
}

export function sumSplits(splits: readonly Split[]): number {
  return splits.reduce((total, split) => total + split.amount, 0);
}

export type ExpenseDraft = {
  description: string;
  /** null when the amount field could not be parsed. */
  amount: number | null;
  paidBy: string | null;
  memberIds: readonly string[];
  splits: readonly Split[];
};

export type ExpenseErrors = Partial<Record<'description' | 'amount' | 'paidBy' | 'splits', string>>;

/** Validates an expense before it is sent. The database enforces the same rules. */
export function validateExpense(draft: ExpenseDraft): ExpenseErrors {
  const errors: ExpenseErrors = {};
  const members = new Set(draft.memberIds);

  if (draft.description.trim().length === 0) {
    errors.description = 'Add a short description.';
  } else if (draft.description.trim().length > 120) {
    errors.description = 'Keep the description under 120 characters.';
  }

  if (draft.amount === null) {
    errors.amount = 'Enter a valid amount.';
  } else if (draft.amount <= 0) {
    errors.amount = 'Amount must be more than ₱0.';
  } else if (draft.amount > MAX_AMOUNT) {
    errors.amount = 'That is more than HATI can track in one expense.';
  }

  if (!draft.paidBy || !members.has(draft.paidBy)) {
    errors.paidBy = 'Choose who paid.';
  }

  if (draft.splits.length === 0) {
    errors.splits = 'Pick at least one person to split with.';
  } else if (draft.splits.some((split) => !members.has(split.userId))) {
    errors.splits = 'Everyone in the split must be a group member.';
  } else if (draft.splits.some((split) => !Number.isInteger(split.amount) || split.amount < 0)) {
    errors.splits = 'Each share must be a valid amount.';
  } else if (
    draft.amount !== null &&
    draft.amount > 0 &&
    sumSplits(draft.splits) !== draft.amount
  ) {
    errors.splits = 'The shares must add up to the total.';
  }

  return errors;
}
