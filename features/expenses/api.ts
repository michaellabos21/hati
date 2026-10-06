import { useMutation } from '@tanstack/react-query';

import type { Split } from '@/features/expenses/splits';
import { useInvalidateLedger } from '@/features/ledger/useLedger';
import { centavosToNumeric } from '@/lib/currency';
import { db } from '@/lib/supabase';
import type { SplitMethod } from '@/types/domain';

export type NewExpense = {
  description: string;
  amount: number;
  paidBy: string;
  splitMethod: SplitMethod;
  splits: Split[];
};

export function useCreateExpense(groupId: string) {
  const invalidate = useInvalidateLedger();
  return useMutation({
    // One call writes the expense and its splits together; the database rejects the lot if the
    // shares do not add up or anyone involved is not a member.
    mutationFn: async (expense: NewExpense) => {
      const { error } = await db().rpc('create_expense', {
        p_group_id: groupId,
        p_description: expense.description.trim(),
        p_amount: centavosToNumeric(expense.amount),
        p_paid_by: expense.paidBy,
        p_split_method: expense.splitMethod,
        p_splits: toSplitRows(expense.splits),
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

const toSplitRows = (splits: Split[]) =>
  splits.map((split) => ({
    user_id: split.userId,
    amount_owed: centavosToNumeric(split.amount),
  }));

export function useUpdateExpense(expenseId: string) {
  const invalidate = useInvalidateLedger();
  return useMutation({
    // Rewrites the expense and its splits together, under the same rules as creating one.
    // Only the person who recorded it is allowed to.
    mutationFn: async (expense: NewExpense) => {
      const { error } = await db().rpc('update_expense', {
        p_expense_id: expenseId,
        p_description: expense.description.trim(),
        p_amount: centavosToNumeric(expense.amount),
        p_paid_by: expense.paidBy,
        p_split_method: expense.splitMethod,
        p_splits: toSplitRows(expense.splits),
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    mutationFn: async (expenseId: string) => {
      // Asking for the deleted row back distinguishes "deleted" from "not allowed", which the
      // database reports as zero rows rather than an error.
      const { data, error } = await db().from('expenses').delete().eq('id', expenseId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Only the person who added this expense can delete it.');
      }
    },
    // Not awaited: the screen navigates away first, so it never shows a deleted expense.
    onSuccess: () => {
      void invalidate();
    },
  });
}
