import { useLocalSearchParams, useRouter } from 'expo-router';

import { ExpenseForm } from '@/components/ExpenseForm';
import { LedgerScreen } from '@/components/LedgerScreen';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/States';
import { useUserId } from '@/features/auth/AuthProvider';
import { useUpdateExpense } from '@/features/expenses/api';
import { toMessage } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import type { Expense, Group } from '@/types/domain';

export default function EditExpenseScreen() {
  const router = useRouter();
  const userId = useUserId();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <LedgerScreen bare>
      {(ledger) => {
        const expense = ledger.expenses.find((candidate) => candidate.id === id);
        const group = expense && ledger.groups.find((g) => g.id === expense.groupId);
        // The database enforces this too; checking here avoids showing a form that cannot save.
        if (!expense || !group || expense.createdBy !== userId) {
          return (
            <Screen>
              <EmptyState
                emoji="🔒"
                title="This expense can’t be edited"
                body="Only the person who added an expense can change it."
                action={<Button label="Go back" onPress={() => leaveScreen(router, '/')} />}
              />
            </Screen>
          );
        }
        return <EditExpense expense={expense} group={group} userId={userId} />;
      }}
    </LedgerScreen>
  );
}

function EditExpense({
  expense,
  group,
  userId,
}: {
  expense: Expense;
  group: Group;
  userId: string;
}) {
  const router = useRouter();
  const update = useUpdateExpense(expense.id);

  return (
    <ExpenseForm
      group={group}
      userId={userId}
      initial={expense}
      submitLabel="Save changes"
      onSubmit={(changes) => update.mutate(changes, { onSuccess: () => router.back() })}
      pending={update.isPending}
      error={update.isError ? toMessage(update.error) : null}
    />
  );
}
