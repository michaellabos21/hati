import { useMutation } from '@tanstack/react-query';

import { useInvalidateLedger } from '@/features/ledger/useLedger';
import { centavosToNumeric } from '@/lib/currency';
import { db } from '@/lib/supabase';

export type NewSettlement = {
  from: string;
  to: string;
  amount: number;
};

export function useRecordSettlement(groupId: string) {
  const invalidate = useInvalidateLedger();
  return useMutation({
    // The database only accepts this from the payer or the payee, between two current members.
    mutationFn: async ({ from, to, amount }: NewSettlement) => {
      const { error } = await db()
        .from('settlements')
        .insert({
          group_id: groupId,
          from_user: from,
          to_user: to,
          amount: centavosToNumeric(amount),
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
export function useDeleteSettlement() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    // Undo: the database lets either the payer or the payee remove a payment.
    mutationFn: async (settlementId: string) => {
      const { data, error } = await db()
        .from('settlements')
        .delete()
        .eq('id', settlementId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Only the people in a payment can remove it.');
      }
    },
    onSuccess: invalidate,
  });
}
