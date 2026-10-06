// Validates rows coming back from Supabase and converts them to app shapes (camelCase,
// centavos). Parsing here means a schema drift fails loudly in one place instead of showing
// wrong money somewhere in the UI.
import { z } from 'zod';

import { numericToCentavos } from '@/lib/currency';
import type { Expense, Group, Ledger, Profile, Settlement } from '@/types/domain';

const money = z.union([z.number(), z.string()]).transform((value) => numericToCentavos(value));

const memberRow = z.object({
  id: z.string(),
  display_name: z.string(),
});

const profileRow = memberRow.extend({
  gcash_number: z.string().nullable(),
  maya_number: z.string().nullable(),
});

export const groupRow = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  group_members: z.array(
    z.object({
      user_id: z.string(),
      profiles: memberRow.nullable(),
    }),
  ),
});

export const expenseRow = z.object({
  id: z.string(),
  group_id: z.string(),
  description: z.string(),
  amount: money,
  paid_by: z.string(),
  created_by: z.string().nullable(),
  split_method: z.enum(['equal', 'exact']),
  created_at: z.string(),
  expense_splits: z.array(z.object({ user_id: z.string(), amount_owed: money })),
});

export const settlementRow = z.object({
  id: z.string(),
  group_id: z.string(),
  from_user: z.string(),
  to_user: z.string(),
  amount: money,
  created_by: z.string().nullable(),
  created_at: z.string(),
});

export const FORMER_MEMBER = 'Former member';

export function toProfile(row: z.infer<typeof profileRow>): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    gcashNumber: row.gcash_number,
    mayaNumber: row.maya_number,
  };
}

function toGroup(row: z.infer<typeof groupRow>): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    members: row.group_members
      .map((member) =>
        member.profiles
          ? { id: member.profiles.id, displayName: member.profiles.display_name }
          : { id: member.user_id, displayName: FORMER_MEMBER },
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}

function toExpense(row: z.infer<typeof expenseRow>): Expense {
  return {
    id: row.id,
    groupId: row.group_id,
    description: row.description,
    amount: row.amount,
    paidBy: row.paid_by,
    createdBy: row.created_by,
    splitMethod: row.split_method,
    createdAt: row.created_at,
    splits: row.expense_splits.map((split) => ({
      userId: split.user_id,
      amount: split.amount_owed,
    })),
  };
}

function toSettlement(row: z.infer<typeof settlementRow>): Settlement {
  return {
    id: row.id,
    groupId: row.group_id,
    from: row.from_user,
    to: row.to_user,
    amount: row.amount,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function parseLedger(raw: {
  groups: unknown;
  expenses: unknown;
  settlements: unknown;
}): Ledger {
  return {
    groups: z.array(groupRow).parse(raw.groups).map(toGroup),
    expenses: z.array(expenseRow).parse(raw.expenses).map(toExpense),
    settlements: z.array(settlementRow).parse(raw.settlements).map(toSettlement),
  };
}

export const profileSchema = profileRow;
