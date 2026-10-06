import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LoginValues, ProfileValues, SignupValues } from '@/features/auth/schemas';
import { z } from 'zod';

import { profileSchema, toProfile } from '@/features/ledger/schema';
import { db } from '@/lib/supabase';
import type { Profile } from '@/types/domain';

export async function logIn({ email, password }: LoginValues) {
  const { error } = await db().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Creates the account. The display name travels as sign-up metadata and the database turns it
 * into a profile row. Returns whether the user still has to confirm their email before a
 * session exists.
 */
export async function signUp({ email, password, displayName }: SignupValues) {
  const { data, error } = await db().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return { needsEmailConfirmation: data.session === null };
}

export async function logOut() {
  const { error } = await db().auth.signOut();
  if (error) throw error;
}

// Goes through get_my_profile because wallet numbers are not readable from the table itself.
async function fetchProfile(): Promise<Profile> {
  const { data, error } = await db().rpc('get_my_profile');
  if (error) throw error;
  const [row] = z.array(profileSchema).parse(data ?? []);
  if (!row) throw new Error('Your profile could not be found. Try logging out and back in.');
  return toProfile(row);
}

export function useProfile(userId: string) {
  return useQuery({ queryKey: ['profile', userId], queryFn: fetchProfile });
}

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: ProfileValues) => {
      const { error } = await db()
        .from('profiles')
        .update({
          display_name: values.displayName,
          gcash_number: values.gcashNumber || null,
          maya_number: values.mayaNumber || null,
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile', userId] }),
        // Group mates see this name too.
        queryClient.invalidateQueries({ queryKey: ['ledger'] }),
      ]),
  });
}
