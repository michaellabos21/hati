import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BalanceTicket } from '@/components/BalanceTicket';
import { GroupGate } from '@/components/GroupGate';
import { ActivityRow, Row, RowGroup } from '@/components/Rows';
import { Amount } from '@/components/ui/Amount';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';
import { Section } from '@/components/ui/Section';
import { EmptyState, FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useLeaveGroup } from '@/features/groups/api';
import { groupEmoji } from '@/features/groups/emoji';
import type { GroupView } from '@/features/ledger/selectors';
import { confirm } from '@/lib/confirm';
import { formatPeso } from '@/lib/currency';
import { toMessage } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';

export default function GroupDetailScreen() {
  const router = useRouter();

  return (
    <GroupGate
      footer={(view) => {
        const id = view.group.id;
        // Alone in the group there is nothing to split yet, so the one useful action is inviting.
        if (view.group.members.length === 1) {
          return (
            <Button
              label="Invite someone"
              icon={<Ionicons name="person-add-outline" size={18} color={colors.ink} />}
              onPress={() => router.push({ pathname: '/groups/[id]/add-member', params: { id } })}
            />
          );
        }
        return (
          <View style={styles.footer}>
            <Button
              label="Settle up"
              variant="secondary"
              style={styles.footerSecondary}
              onPress={() => router.push({ pathname: '/groups/[id]/balances', params: { id } })}
            />
            <Button
              label="Add expense"
              style={styles.footerPrimary}
              icon={<Ionicons name="add" size={22} color={colors.ink} />}
              onPress={() => router.push({ pathname: '/groups/[id]/add-expense', params: { id } })}
            />
          </View>
        );
      }}>
      {(view, userId) => <GroupDetail view={view} userId={userId} />}
    </GroupGate>
  );
}

function memberStatus(net: number) {
  if (net > 0) return 'gets back';
  if (net < 0) return 'owes';
  return 'settled up';
}

function GroupDetail({ view, userId }: { view: GroupView; userId: string }) {
  const router = useRouter();
  const { group, expenses, balances, mine } = view;
  const leave = useLeaveGroup(group.id, userId);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const alone = group.members.length === 1;

  const onLeave = async () => {
    setLeaveError(null);
    if (mine.net !== 0) {
      setLeaveError(
        mine.net < 0
          ? `Settle up first. You still owe ${formatPeso(-mine.net, { compact: true })} here.`
          : `Settle up first. You are still owed ${formatPeso(mine.net, { compact: true })} here.`,
      );
      return;
    }
    const yes = await confirm({
      title: `Leave ${group.name}?`,
      message: 'You will stop seeing this group. Someone in it can add you back later.',
      confirmLabel: 'Leave group',
      destructive: true,
    });
    if (!yes) return;
    leave.mutate(undefined, {
      onSuccess: () => leaveScreen(router, '/groups'),
      onError: (error) => setLeaveError(toMessage(error)),
    });
  };

  return (
    <>
      <FadeIn>
        <Text variant="title" accessibilityRole="header">
          {groupEmoji(group.name)} {group.name}
        </Text>
        {group.description ? <Text color={colors.inkSoft}>{group.description}</Text> : null}
      </FadeIn>

      <FadeIn order={1}>
        <BalanceTicket
          totals={mine}
          caption={alone ? 'Just you so far' : `${group.members.length} members`}
          empty={expenses.length === 0}
        />
      </FadeIn>

      {alone ? (
        <FadeIn order={2}>
          <EmptyState
            emoji="👋"
            title="Invite your barkada"
            body="Send an invite by email. Once they accept, you can start splitting."
          />
        </FadeIn>
      ) : (
        <FadeIn order={2}>
          <Section title={expenses.length > 0 ? `Expenses · ${expenses.length}` : 'Expenses'}>
            {expenses.length === 0 ? (
              <Text color={colors.inkSoft}>
                No expenses yet. Tap “Add expense” when someone pays for something.
              </Text>
            ) : (
              <RowGroup>
                {expenses.map((expense) => (
                  <ActivityRow
                    key={expense.id}
                    item={{
                      kind: 'expense',
                      id: expense.id,
                      createdAt: expense.createdAt,
                      group,
                      expense,
                    }}
                    viewerId={userId}
                    onPress={() =>
                      router.push({ pathname: '/expenses/[id]', params: { id: expense.id } })
                    }
                  />
                ))}
              </RowGroup>
            )}
          </Section>
        </FadeIn>
      )}

      <FadeIn order={3}>
        <Section
          title={`Members · ${group.members.length}`}
          trailing={
            <Button
              label="Invite"
              variant="secondary"
              compact
              icon={<Ionicons name="person-add-outline" size={16} color={colors.ink} />}
              accessibilityHint="Invite someone to this group"
              onPress={() =>
                router.push({ pathname: '/groups/[id]/add-member', params: { id: group.id } })
              }
            />
          }>
          <RowGroup>
            {group.members.map((member) => {
              const net = balances[member.id] ?? 0;
              const name =
                member.id === userId ? `${member.displayName} (you)` : member.displayName;
              return (
                <Row
                  key={member.id}
                  leading={<Avatar id={member.id} name={member.displayName} />}
                  title={name}
                  subtitle={memberStatus(net)}
                  trailing={net === 0 ? undefined : <Amount centavos={net} tone="balance" signed />}
                  accessibilityLabel={`${name}, ${memberStatus(net)}${net === 0 ? '' : ` ${formatPeso(Math.abs(net))}`}`}
                />
              );
            })}
          </RowGroup>
        </Section>
      </FadeIn>

      <View style={styles.leave}>
        <FormError message={leaveError} />
        <Button label="Leave group" variant="ghost" onPress={onLeave} loading={leave.isPending} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerSecondary: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  footerPrimary: {
    flex: 1.6,
    paddingHorizontal: spacing.md,
  },
  leave: {
    gap: spacing.md,
  },
});
