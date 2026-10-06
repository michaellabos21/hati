import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { useInvalidateLedger } from '@/features/ledger/useLedger';
import { db } from '@/lib/supabase';

/** An invite waiting for the signed-in user to accept or decline. */
export type MyInvite = {
  id: string;
  groupId: string;
  groupName: string;
  invitedByName: string | null;
  memberCount: number;
  createdAt: string;
};

/** Someone a group has invited who has not answered yet. */
export type PendingInvite = {
  id: string;
  userId: string;
  displayName: string;
  createdAt: string;
};

const myInviteRow = z.object({
  id: z.string(),
  group_id: z.string(),
  group_name: z.string(),
  invited_by_name: z.string().nullable(),
  member_count: z.number(),
  created_at: z.string(),
});

const pendingInviteRow = z.object({
  id: z.string(),
  invited_user: z.string(),
  display_name: z.string(),
  created_at: z.string(),
});

export const MY_INVITES_KEY = ['invites', 'mine'] as const;
const groupInvitesKey = (groupId: string) => ['invites', 'group', groupId] as const;

async function fetchMyInvites(): Promise<MyInvite[]> {
  const { data, error } = await db().rpc('get_my_invites');
  if (error) throw error;
  return z
    .array(myInviteRow)
    .parse(data ?? [])
    .map((row) => ({
      id: row.id,
      groupId: row.group_id,
      groupName: row.group_name,
      invitedByName: row.invited_by_name,
      memberCount: row.member_count,
      createdAt: row.created_at,
    }));
}

export function useMyInvites() {
  return useQuery({ queryKey: MY_INVITES_KEY, queryFn: fetchMyInvites });
}

export function useGroupInvites(groupId: string) {
  return useQuery({
    queryKey: groupInvitesKey(groupId),
    queryFn: async (): Promise<PendingInvite[]> => {
      const { data, error } = await db().rpc('get_group_invites', { p_group_id: groupId });
      if (error) throw error;
      return z
        .array(pendingInviteRow)
        .parse(data ?? [])
        .map((row) => ({
          id: row.id,
          userId: row.invited_user,
          displayName: row.display_name,
          createdAt: row.created_at,
        }));
    },
  });
}

export class UserNotFoundError extends Error {
  constructor() {
    super('No HATI account uses that email yet. Ask them to sign up first.');
    this.name = 'UserNotFoundError';
  }
}

export function useInviteMember(groupId: string, memberIds: readonly string[]) {
  const queryClient = useQueryClient();
  return useMutation({
    /**
     * Invites the account with exactly this email. They join only if they accept.
     * Returns their display name.
     */
    mutationFn: async (email: string): Promise<string> => {
      const found = await db().rpc('find_user_by_email', { search_email: email });
      if (found.error) throw found.error;
      const match = z
        .array(z.object({ id: z.string(), display_name: z.string() }))
        .parse(found.data ?? [])[0];
      if (!match) throw new UserNotFoundError();
      // The database refuses this too; checking here gives a clearer message.
      if (memberIds.includes(match.id)) {
        throw new Error(`${match.display_name} is already in this group.`);
      }

      const { error } = await db()
        .from('group_invites')
        .insert({ group_id: groupId, invited_user: match.id });
      if (error) throw error;
      return match.display_name;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupInvitesKey(groupId) }),
  });
}

/** Withdraws an invite the group sent. */
export function useWithdrawInvite(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await db().from('group_invites').delete().eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupInvitesKey(groupId) }),
  });
}

/** Accepts an invite: the signed-in user becomes a member. Returns the group's id. */
export function useAcceptInvite() {
  const queryClient = useQueryClient();
  const invalidateLedger = useInvalidateLedger();
  return useMutation({
    mutationFn: async (inviteId: string): Promise<string> => {
      const { data, error } = await db().rpc('accept_group_invite', { p_invite_id: inviteId });
      if (error) throw error;
      return z.string().parse(data);
    },
    // Wait for both, so the group is on screen by the time the invite card disappears.
    onSuccess: () =>
      Promise.all([
        invalidateLedger(),
        queryClient.invalidateQueries({ queryKey: MY_INVITES_KEY }),
      ]),
  });
}

export function useDeclineInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await db().from('group_invites').delete().eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_INVITES_KEY }),
  });
}
