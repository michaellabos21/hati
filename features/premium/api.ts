import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { db } from '@/lib/supabase';

/** What Premium is planned to include. Shown on the Premium screen; none of it is built yet. */
export const PREMIUM_FEATURES = [
  {
    emoji: '👯',
    title: 'Unlimited groups',
    detail: 'As many barkadas, trips and bahay as you have.',
  },
  { emoji: '🧾', title: 'Receipt scanning', detail: 'Snap the resibo instead of typing it in.' },
  { emoji: '🔁', title: 'Recurring expenses', detail: 'Rent, WiFi and Netflix add themselves.' },
  { emoji: '📊', title: 'Advanced reports', detail: 'See where the group’s money went.' },
  { emoji: '🔔', title: 'Smart debt reminders', detail: 'Friendly nudges, sent for you.' },
  { emoji: '📤', title: 'Export expenses', detail: 'Download everything as a spreadsheet.' },
] as const;

/** Planned price in centavos per month. */
export const PREMIUM_PRICE = 9900;

const KEY = ['premium-interest'] as const;

/** Whether the signed-in user has already asked to hear about Premium. */
export function usePremiumInterest() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<boolean> => {
      // Row Level Security returns only the caller's own row, if there is one.
      const { data, error } = await db().from('premium_interest').select('user_id');
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });
}

/** Records interest. Nothing is charged and nothing is unlocked. */
export function useRegisterPremiumInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // user_id defaults to the signed-in user in the database.
      const { error } = await db().from('premium_interest').insert({});
      // Already on the list is a success, not an error.
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => queryClient.setQueryData(KEY, true),
  });
}
