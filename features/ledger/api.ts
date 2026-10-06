import { parseLedger } from '@/features/ledger/schema';
import { db } from '@/lib/supabase';
import type { Ledger } from '@/types/domain';

/**
 * Loads everything the signed-in user can see in three parallel requests. Row Level Security
 * decides what comes back, so there are no user or group filters here to get wrong.
 *
 * `group_members!inner` drops groups the user created but has since left (they can still read
 * the group row itself, but not its members).
 */
export async function fetchLedger(): Promise<Ledger> {
  const [groups, expenses, settlements] = await Promise.all([
    db()
      .from('groups')
      .select(
        'id, name, description, created_by, created_at, group_members!inner(user_id, profiles(id, display_name))',
      )
      .order('created_at', { ascending: false }),
    db()
      .from('expenses')
      .select(
        'id, group_id, description, amount, paid_by, created_by, split_method, created_at, expense_splits(user_id, amount_owed)',
      )
      .order('created_at', { ascending: false }),
    db()
      .from('settlements')
      .select('id, group_id, from_user, to_user, amount, created_by, created_at')
      .order('created_at', { ascending: false }),
  ]);

  if (groups.error) throw groups.error;
  if (expenses.error) throw expenses.error;
  if (settlements.error) throw settlements.error;

  return parseLedger({
    groups: groups.data,
    expenses: expenses.data,
    settlements: settlements.data,
  });
}
