import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { z } from 'zod';

import { MY_INVITES_KEY } from '@/features/invites/api';
import { useInvalidateLedger } from '@/features/ledger/useLedger';
import { db } from '@/lib/supabase';

// --- Pure helpers -------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tokens are uuids. Anything else in the URL is not worth sending to the server. */
export function isInviteToken(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function buildInviteUrl(origin: string, token: string) {
  return `${origin.replace(/\/+$/, '')}/join/${token}`;
}

/** The message a member pastes into the group chat. */
export function buildInviteMessage(groupName: string, url: string) {
  return `Sali ka sa “${groupName.trim()}” sa HATI para hati-hati tayo sa gastos 🙌\n${url}`;
}

export function daysLeft(expiresAt: string, now: Date = new Date()) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000));
}

/**
 * Where invite links point. On web that is wherever the app is being served from; in the
 * native app it is the public site, set at build time.
 */
export function webOrigin() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return process.env.EXPO_PUBLIC_WEB_URL?.trim() || 'https://hati-gamma.vercel.app';
}

// --- A group's link, for its members ------------------------------------------------------

export type InviteLink = { token: string; expiresAt: string };

const linkRow = z.object({ token: z.string(), expires_at: z.string() });
const linkKey = (groupId: string) => ['invite-link', groupId] as const;

export function useInviteLink(groupId: string) {
  return useQuery({
    queryKey: linkKey(groupId),
    queryFn: async (): Promise<InviteLink | null> => {
      const { data, error } = await db()
        .from('group_invite_links')
        .select('token, expires_at')
        .eq('group_id', groupId);
      if (error) throw error;
      const row = z.array(linkRow).parse(data ?? [])[0];
      // An expired link is as good as none: offer to make a new one.
      if (!row || new Date(row.expires_at).getTime() <= Date.now()) return null;
      return { token: row.token, expiresAt: row.expires_at };
    },
  });
}

/** Creates the group's link, replacing any existing one (which stops working). */
export function useCreateInviteLink(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<InviteLink> => {
      const removed = await db().from('group_invite_links').delete().eq('group_id', groupId);
      if (removed.error) throw removed.error;
      const { data, error } = await db()
        .from('group_invite_links')
        .insert({ group_id: groupId })
        .select('token, expires_at')
        .single();
      if (error) throw error;
      const row = linkRow.parse(data);
      return { token: row.token, expiresAt: row.expires_at };
    },
    onSuccess: (link) => queryClient.setQueryData(linkKey(groupId), link),
  });
}

/** Turns the group's link off. */
export function useRemoveInviteLink(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await db().from('group_invite_links').delete().eq('group_id', groupId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.setQueryData(linkKey(groupId), null),
  });
}

// --- Opening a link -----------------------------------------------------------------------

export type InviteLinkInfo = {
  groupId: string;
  groupName: string;
  invitedByName: string | null;
  memberCount: number;
  alreadyMember: boolean;
};

const infoRow = z.object({
  group_id: z.string(),
  group_name: z.string(),
  invited_by_name: z.string().nullable(),
  member_count: z.number(),
  already_member: z.boolean(),
});

/** What the link leads to, or null when it is wrong, expired or has been turned off. */
export function useInviteLinkInfo(token: string | null) {
  return useQuery({
    queryKey: ['invite-link-info', token],
    enabled: token !== null,
    queryFn: async (): Promise<InviteLinkInfo | null> => {
      const { data, error } = await db().rpc('get_invite_link', { p_token: token });
      if (error) throw error;
      const row = z.array(infoRow).parse(data ?? [])[0];
      if (!row) return null;
      return {
        groupId: row.group_id,
        groupName: row.group_name,
        invitedByName: row.invited_by_name,
        memberCount: row.member_count,
        alreadyMember: row.already_member,
      };
    },
  });
}

export function useJoinWithLink() {
  const queryClient = useQueryClient();
  const invalidateLedger = useInvalidateLedger();
  return useMutation({
    mutationFn: async (token: string): Promise<string> => {
      const { data, error } = await db().rpc('join_group_with_link', { p_token: token });
      if (error) throw error;
      return z.string().parse(data);
    },
    onSuccess: () =>
      Promise.all([
        invalidateLedger(),
        queryClient.invalidateQueries({ queryKey: MY_INVITES_KEY }),
      ]),
  });
}

// --- Remembering a link across sign-up ----------------------------------------------------
// Someone who opens a link before they have an account has to sign up first. The token is
// kept on the device so they land back on the invite afterwards.

const PENDING_KEY = 'hati.pendingInviteToken';

export async function rememberInviteToken(token: string) {
  try {
    await AsyncStorage.setItem(PENDING_KEY, token);
  } catch {
    // Without storage they can simply open the link again after signing up.
  }
}

/** Returns the remembered token once, then forgets it. */
export async function takeRememberedInviteToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(PENDING_KEY);
    if (token) await AsyncStorage.removeItem(PENDING_KEY);
    return isInviteToken(token) ? token : null;
  } catch {
    return null;
  }
}
