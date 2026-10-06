import { useRouter } from 'expo-router';

import { ExpenseForm } from '@/components/ExpenseForm';
import { GroupGate } from '@/components/GroupGate';
import { useCreateExpense } from '@/features/expenses/api';
import type { GroupView } from '@/features/ledger/selectors';
import { toMessage } from '@/lib/errors';

export default function AddExpenseScreen() {
  return <GroupGate bare>{(view, userId) => <AddExpense view={view} userId={userId} />}</GroupGate>;
}

function AddExpense({ view, userId }: { view: GroupView; userId: string }) {
  const router = useRouter();
  const create = useCreateExpense(view.group.id);

  return (
    <ExpenseForm
      group={view.group}
      userId={userId}
      submitLabel="Add expense"
      onSubmit={(expense) => create.mutate(expense, { onSuccess: () => router.back() })}
      pending={create.isPending}
      error={create.isError ? toMessage(create.error) : null}
    />
  );
}
