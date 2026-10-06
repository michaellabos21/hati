// Demo mode's stand-in for the Supabase client: the same calls the app makes, answered from
// memory with sample data. Nothing leaves the device and nothing is saved; reloading resets it.
//
// It mirrors the rules the real database enforces (membership scoping, joining only by accepting an invite,
// splits that add up, no leaving with a balance, payments only by a party) so the demo behaves like the real thing,
// but it is NOT a security boundary and is never used unless EXPO_PUBLIC_DEMO_MODE is "true".
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  createSampleTables,
  createSampleUsers,
  DEMO_PASSWORD,
  type DemoRow,
  type DemoTables,
  type DemoUser,
} from '@/lib/demo/sampleData';

type Result = { data: unknown; error: { message: string; code?: string } | null };
type DemoSession = { user: { id: string; email: string } };
type AuthListener = (event: string, session: DemoSession | null) => void;

const SESSION_KEY = 'hati.demo.user';
const LATENCY_MS = 250;

const ok = (data: unknown = null): Result => ({ data, error: null });
const fail = (message: string, code?: string): Result => ({ data: null, error: { message, code } });
const later = <T>(value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
const str = (value: unknown) => String(value);
const num = (value: unknown) => Number(value);

export function createDemoClient(): SupabaseClient {
  const users: DemoUser[] = createSampleUsers();
  const tables: DemoTables = createSampleTables();
  const listeners = new Set<AuthListener>();
  let session: DemoSession | null = null;
  let counter = 1;
  const newId = (kind: string) => `demo-${kind}-new-${counter++}`;

  const me = () => session?.user.id ?? '';
  const isMember = (groupId: unknown, userId: unknown) =>
    tables.group_members.some((m) => m.group_id === groupId && m.user_id === userId);
  const myGroupIds = () =>
    new Set(tables.group_members.filter((m) => m.user_id === me()).map((m) => m.group_id));
  const profile = (user: DemoUser) => ({
    id: user.id,
    display_name: user.display_name,
    gcash_number: user.gcash_number,
    maya_number: user.maya_number,
  });
  // What group mates may see of each other: the name only, as in the real database.
  const memberById = (id: unknown) => {
    const user = users.find((candidate) => candidate.id === id);
    return user ? { id: user.id, display_name: user.display_name } : null;
  };
  const newestFirst = (a: DemoRow, b: DemoRow) =>
    str(b.created_at).localeCompare(str(a.created_at));

  /** Net balance in centavos, the same sum as private.member_balance in the database. */
  const balance = (groupId: unknown, userId: unknown) => {
    const cents = (value: unknown) => Math.round(num(value) * 100);
    const groupExpenses = tables.expenses.filter((e) => e.group_id === groupId);
    const expenseIds = new Set(groupExpenses.map((e) => e.id));
    let total = 0;
    for (const e of groupExpenses) if (e.paid_by === userId) total += cents(e.amount);
    for (const s of tables.expense_splits) {
      if (expenseIds.has(s.expense_id) && s.user_id === userId) total -= cents(s.amount_owed);
    }
    for (const s of tables.settlements.filter((row) => row.group_id === groupId)) {
      if (s.from_user === userId) total += cents(s.amount);
      if (s.to_user === userId) total -= cents(s.amount);
    }
    return total;
  };

  /** Has this person paid, recorded or settled anything in the group themselves? */
  const hasOwnActivity = (groupId: unknown, userId: unknown) =>
    tables.expenses.some(
      (e) => e.group_id === groupId && (e.paid_by === userId || e.created_by === userId),
    ) ||
    tables.settlements.some(
      (s) => s.group_id === groupId && (s.from_user === userId || s.to_user === userId),
    );

  const setSession = async (user: DemoUser | null, event: string) => {
    session = user ? { user: { id: user.id, email: user.email } } : null;
    try {
      if (user) await AsyncStorage.setItem(SESSION_KEY, user.id);
      else await AsyncStorage.removeItem(SESSION_KEY);
    } catch {
      // Staying signed in across reloads is a convenience; the demo works without it.
    }
    listeners.forEach((listener) => listener(event, session));
  };

  function select(table: string): Result {
    const mine = myGroupIds();
    switch (table) {
      case 'groups':
        return ok(
          tables.groups
            .filter((group) => mine.has(group.id))
            .sort(newestFirst)
            .map((group) => ({
              ...group,
              group_members: tables.group_members
                .filter((m) => m.group_id === group.id)
                .map((m) => ({ user_id: m.user_id, profiles: memberById(m.user_id) })),
            })),
        );
      case 'expenses':
        return ok(
          tables.expenses
            .filter((expense) => mine.has(expense.group_id))
            .sort(newestFirst)
            .map((expense) => ({
              ...expense,
              expense_splits: tables.expense_splits.filter((s) => s.expense_id === expense.id),
            })),
        );
      case 'settlements':
        return ok(tables.settlements.filter((s) => mine.has(s.group_id)).sort(newestFirst));
      default:
        return fail(`Demo mode does not support reading ${table}.`);
    }
  }

  function insert(table: string, row: DemoRow): Result {
    switch (table) {
      case 'groups': {
        const group = {
          id: newId('group'),
          created_by: me(),
          created_at: new Date().toISOString(),
          ...row,
        };
        tables.groups.push(group);
        tables.group_members.push({ group_id: group.id, user_id: me() });
        return ok([group]);
      }
      case 'group_members':
        // Membership only comes from creating a group or accepting an invite.
        return fail('new row violates row-level security policy');
      case 'group_invites':
        if (!isMember(row.group_id, me()) || isMember(row.group_id, row.invited_user)) {
          return fail('new row violates row-level security policy');
        }
        if (
          tables.group_invites.some(
            (i) => i.group_id === row.group_id && i.invited_user === row.invited_user,
          )
        ) {
          return fail(
            'duplicate key value violates unique constraint "group_invites_one_per_person"',
            '23505',
          );
        }
        tables.group_invites.push({
          id: newId('invite'),
          invited_by: me(),
          created_at: new Date().toISOString(),
          ...row,
        });
        return ok();
      case 'settlements':
        if (
          ![row.from_user, row.to_user].includes(me()) ||
          !isMember(row.group_id, row.from_user) ||
          !isMember(row.group_id, row.to_user)
        ) {
          return fail('new row violates row-level security policy');
        }
        tables.settlements.push({
          id: newId('settlement'),
          created_by: me(),
          created_at: new Date().toISOString(),
          ...row,
          amount: num(row.amount),
        });
        return ok();
      default:
        return fail(`Demo mode does not support adding to ${table}.`);
    }
  }

  function remove(table: string, filters: [string, unknown][]): Result {
    const matches = (row: DemoRow) => filters.every(([key, value]) => row[key] === value);
    switch (table) {
      case 'expenses': {
        const gone = tables.expenses.filter((e) => matches(e) && e.created_by === me());
        const goneIds = new Set(gone.map((e) => e.id));
        tables.expenses = tables.expenses.filter((e) => !goneIds.has(e.id));
        tables.expense_splits = tables.expense_splits.filter((s) => !goneIds.has(s.expense_id));
        return ok(gone.map((e) => ({ id: e.id })));
      }
      case 'group_members': {
        const leaving = tables.group_members.filter((m) => matches(m) && m.user_id === me());
        if (
          leaving.some(
            (m) => hasOwnActivity(m.group_id, m.user_id) && balance(m.group_id, m.user_id) !== 0,
          )
        ) {
          return fail('Settle up before leaving this group.', '23514');
        }
        tables.group_members = tables.group_members.filter((m) => !leaving.includes(m));
        return ok();
      }
      case 'group_invites':
        // The invited person declines, or a member withdraws.
        tables.group_invites = tables.group_invites.filter(
          (i) => !(matches(i) && (i.invited_user === me() || isMember(i.group_id, me()))),
        );
        return ok();
      default:
        return fail(`Demo mode does not support deleting from ${table}.`);
    }
  }

  function update(table: string, changes: DemoRow, filters: [string, unknown][]): Result {
    if (table !== 'profiles') return fail(`Demo mode does not support editing ${table}.`);
    const target = users.find(
      (user) =>
        user.id === me() && filters.every(([key, value]) => user[key as keyof DemoUser] === value),
    );
    if (target) Object.assign(target, changes);
    return ok();
  }

  /** The small part of the query builder the app uses: chain, then await. */
  function from(table: string) {
    let action: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: DemoRow = {};
    let single = false;
    const filters: [string, unknown][] = [];

    const run = (): Result => {
      if (!session) return fail('JWT expired');
      const result =
        action === 'insert'
          ? insert(table, payload)
          : action === 'update'
            ? update(table, payload, filters)
            : action === 'delete'
              ? remove(table, filters)
              : select(table);
      if (single && Array.isArray(result.data)) {
        return result.data.length > 0 ? ok(result.data[0]) : fail('No rows found', 'PGRST116');
      }
      return result;
    };

    const builder = {
      // After insert/update/delete, select() only asks for the affected rows back.
      select: () => builder,
      insert: (row: DemoRow) => {
        action = 'insert';
        payload = row;
        return builder;
      },
      update: (row: DemoRow) => {
        action = 'update';
        payload = row;
        return builder;
      },
      delete: () => {
        action = 'delete';
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      order: () => builder,
      single: () => {
        single = true;
        return builder;
      },
      then: <A, B>(resolve: (value: Result) => A, reject?: (reason: unknown) => B) =>
        later(null).then(run).then(resolve, reject),
    };
    return builder;
  }

  function rpc(name: string, args: Record<string, unknown> = {}) {
    const run = (): Result => {
      if (!session) return fail('JWT expired');
      if (name === 'get_my_profile') {
        return ok(users.filter((user) => user.id === me()).map(profile));
      }
      if (name === 'get_my_invites') {
        return ok(
          tables.group_invites
            .filter((invite) => invite.invited_user === me())
            .sort(newestFirst)
            .map((invite) => ({
              id: invite.id,
              group_id: invite.group_id,
              group_name: str(tables.groups.find((g) => g.id === invite.group_id)?.name ?? ''),
              invited_by_name: memberById(invite.invited_by)?.display_name ?? null,
              member_count: tables.group_members.filter((m) => m.group_id === invite.group_id)
                .length,
              created_at: invite.created_at,
            })),
        );
      }
      if (name === 'get_group_invites') {
        if (!isMember(args.p_group_id, me())) return ok([]);
        return ok(
          tables.group_invites
            .filter((invite) => invite.group_id === args.p_group_id)
            .sort(newestFirst)
            .map((invite) => ({
              id: invite.id,
              invited_user: invite.invited_user,
              display_name: memberById(invite.invited_user)?.display_name ?? '',
              created_at: invite.created_at,
            })),
        );
      }
      if (name === 'accept_group_invite') {
        const invite = tables.group_invites.find(
          (candidate) => candidate.id === args.p_invite_id && candidate.invited_user === me(),
        );
        if (!invite) return fail('This invite is no longer available.', '23514');
        tables.group_members.push({ group_id: invite.group_id, user_id: me() });
        tables.group_invites = tables.group_invites.filter((candidate) => candidate !== invite);
        return ok(invite.group_id);
      }
      if (name === 'find_user_by_email') {
        const email = str(args.search_email).trim().toLowerCase();
        return ok(
          users
            .filter((u) => u.email === email)
            .map((u) => ({ id: u.id, display_name: u.display_name })),
        );
      }
      if (name === 'create_expense') {
        const splits = args.p_splits as { user_id: string; amount_owed: string }[];
        const group = args.p_group_id;
        if (
          !isMember(group, me()) ||
          !isMember(group, args.p_paid_by) ||
          splits.some((split) => !isMember(group, split.user_id))
        ) {
          return fail('new row violates row-level security policy');
        }
        const cents = (value: unknown) => Math.round(num(value) * 100);
        const total = splits.reduce((sum, split) => sum + cents(split.amount_owed), 0);
        if (splits.length === 0) {
          return fail('An expense needs at least one person to split with.', '23514');
        }
        if (total !== cents(args.p_amount)) {
          return fail(
            `Splits total ${total / 100} but the expense is ${num(args.p_amount)}.`,
            '23514',
          );
        }
        const id = newId('expense');
        tables.expenses.push({
          id,
          group_id: group,
          description: str(args.p_description),
          amount: num(args.p_amount),
          paid_by: args.p_paid_by,
          created_by: me(),
          split_method: args.p_split_method,
          created_at: new Date().toISOString(),
        });
        for (const split of splits) {
          tables.expense_splits.push({
            expense_id: id,
            user_id: split.user_id,
            amount_owed: num(split.amount_owed),
          });
        }
        return ok(id);
      }
      return fail(`Demo mode does not support ${name}.`);
    };
    return later(null).then(run);
  }

  const auth = {
    async getSession() {
      if (!session) {
        try {
          const savedId = await AsyncStorage.getItem(SESSION_KEY);
          const user = users.find((candidate) => candidate.id === savedId);
          if (user) session = { user: { id: user.id, email: user.email } };
        } catch {
          // No saved demo session.
        }
      }
      return { data: { session }, error: null };
    },
    onAuthStateChange(listener: AuthListener) {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      await later(null);
      const user = users.find((candidate) => candidate.email === email);
      if (!user || password !== DEMO_PASSWORD) {
        return { data: { session: null }, error: { message: 'Invalid login credentials' } };
      }
      await setSession(user, 'SIGNED_IN');
      return { data: { session }, error: null };
    },
    async signUp({
      email,
      options,
    }: {
      email: string;
      options?: { data?: { display_name?: string } };
    }) {
      await later(null);
      if (users.some((candidate) => candidate.email === email)) {
        return { data: { session: null }, error: { message: 'User already registered' } };
      }
      const user: DemoUser = {
        id: newId('user'),
        email,
        display_name: options?.data?.display_name?.trim() || email.split('@')[0],
        gcash_number: null,
        maya_number: null,
      };
      users.push(user);
      await setSession(user, 'SIGNED_IN');
      return { data: { session }, error: null };
    },
    async signOut() {
      await setSession(null, 'SIGNED_OUT');
      return { error: null };
    },
    startAutoRefresh() {},
    stopAutoRefresh() {},
  };

  // Only the calls above exist; the cast lets the rest of the app keep one client type.
  return { auth, from, rpc } as unknown as SupabaseClient;
}
