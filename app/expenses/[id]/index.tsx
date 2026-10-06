import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LedgerScreen } from '@/components/LedgerScreen';
import { Row, RowGroup } from '@/components/Rows';
import { Amount } from '@/components/ui/Amount';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, Perforation } from '@/components/ui/Card';
import { Section } from '@/components/ui/Section';
import { EmptyState, FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useUserId } from '@/features/auth/AuthProvider';
import { useDeleteExpense } from '@/features/expenses/api';
import { expenseEmoji } from '@/features/groups/emoji';
import { findMember, nameOf } from '@/features/ledger/selectors';
import { FORMER_MEMBER } from '@/features/ledger/schema';
import { confirm } from '@/lib/confirm';
import { formatPeso } from '@/lib/currency';
import { relativeTime } from '@/lib/dates';
import { toMessage } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import type { Expense, Group } from '@/types/domain';

export default function ExpenseScreen() {
  const router = useRouter();
  const userId = useUserId();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <LedgerScreen>
      {(ledger) => {
        const expense = ledger.expenses.find((candidate) => candidate.id === id);
        const group = expense && ledger.groups.find((g) => g.id === expense.groupId);
        if (!expense || !group) {
          return (
            <EmptyState
              emoji="🫥"
              title="Expense not found"
              body="It may have been deleted."
              action={<Button label="Go back" onPress={() => leaveScreen(router, '/')} />}
            />
          );
        }
        return <ExpenseDetail expense={expense} group={group} userId={userId} />;
      }}
    </LedgerScreen>
  );
}

function ExpenseDetail({
  expense,
  group,
  userId,
}: {
  expense: Expense;
  group: Group;
  userId: string;
}) {
  const router = useRouter();
  const remove = useDeleteExpense();
  const mine = expense.createdBy === userId;
  const payer = nameOf(group, expense.paidBy, userId);

  const onDelete = async () => {
    const yes = await confirm({
      title: 'Delete this expense?',
      message: `“${expense.description}” (${formatPeso(expense.amount)}) will be removed and everyone's balances will change.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (yes) remove.mutate(expense.id, { onSuccess: () => leaveScreen(router, '/') });
  };

  return (
    <>
      <Card>
        <Text variant="label" color={colors.inkSoft}>
          {group.name} · {relativeTime(expense.createdAt)}
        </Text>
        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {expenseEmoji(expense.description)} {expense.description}
        </Text>
        <Perforation />
        <View style={styles.totalRow}>
          <Text variant="label" color={colors.inkSoft}>
            {payer} paid
          </Text>
          <Amount centavos={expense.amount} large compact={false} />
        </View>
      </Card>

      <Section title={expense.splitMethod === 'equal' ? 'Split equally' : 'Split by exact amounts'}>
        <RowGroup>
          {expense.splits.map((split) => {
            const member = findMember(group, split.userId);
            const name = nameOf(group, split.userId, userId);
            const settledByPaying = split.userId === expense.paidBy;
            const subtitle = settledByPaying
              ? split.userId === userId
                ? 'Your own share'
                : 'Their own share'
              : `Owes ${payer === 'You' ? 'you' : payer}`;
            return (
              <Row
                key={split.userId}
                leading={<Avatar id={split.userId} name={member?.displayName ?? FORMER_MEMBER} />}
                title={name}
                subtitle={subtitle}
                trailing={<Amount centavos={split.amount} compact={false} />}
                accessibilityLabel={`${name}, ${subtitle}, ${formatPeso(split.amount)}`}
              />
            );
          })}
        </RowGroup>
      </Section>

      <View style={styles.actions}>
        <Text variant="small" color={colors.inkSoft} center>
          Added by {nameOf(group, expense.createdBy ?? '', userId).replace(/^You$/, 'you')}
        </Text>
        <FormError message={remove.isError ? toMessage(remove.error) : null} />
        {mine ? (
          <Button
            label="Edit expense"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/expenses/[id]/edit', params: { id: expense.id } })
            }
          />
        ) : null}
        {mine ? (
          <Button
            label="Delete expense"
            variant="danger"
            onPress={onDelete}
            loading={remove.isPending}
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: {
    gap: spacing.md,
  },
});
