import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

import { useInvalidateLedger } from '@/features/ledger/useLedger';
import { db } from '@/lib/supabase';

export const groupFormSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name.').max(80, 'Keep it under 80 characters.'),
  description: z.string().trim().max(280, 'Keep it under 280 characters.'),
});
export type GroupValues = z.infer<typeof groupFormSchema>;

export function useCreateGroup() {
  const invalidate = useInvalidateLedger();
  return useMutation({
    // The database makes the creator the first member.
    mutationFn: async ({ name, description }: GroupValues): Promise<string> => {
      const { data, error } = await db()
        .from('groups')
        .insert({ name, description: description || null })
        .select('id')
        .single();
      if (error) throw error;
      return z.object({ id: z.string() }).parse(data).id;
    },
    onSuccess: invalidate,
  });
}

export function useLeaveGroup(groupId: string, userId: string) {
  const invalidate = useInvalidateLedger();
  return useMutation({
    // The database refuses this while the member still owes or is owed money.
    mutationFn: async () => {
      const { error } = await db()
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);
      if (error) throw error;
    },
    // Not awaited: the screen navigates away first, so it never shows a group the user left.
    onSuccess: () => {
      void invalidate();
    },
  });
}
