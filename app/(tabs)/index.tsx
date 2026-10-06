import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BalanceTicket } from '@/components/BalanceTicket';
import { LedgerScreen } from '@/components/LedgerScreen';
import { ActivityRow, GroupRow, Row, RowGroup } from '@/components/Rows';
import { Amount } from '@/components/ui/Amount';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FadeIn } from '@/components/ui/FadeIn';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useProfile } from '@/features/auth/api';
import { useUserId } from '@/features/auth/AuthProvider';
import { FORMER_MEMBER } from '@/features/ledger/schema';
import {
  findMember,
  selectActivity,
  selectDashboard,
  selectMyDebts,
} from '@/features/ledger/selectors';
import { formatPeso } from '@/lib/currency';
import { greeting } from '@/lib/dates';
import type { Ledger } from '@/types/domain';

const RECENT_GROUPS = 4;
const RECENT_ACTIVITY = 5;
const TOP_DEBTS = 5;

export default function HomeScreen() {
  return <LedgerScreen safeTop>{(ledger) => <Dashboard ledger={ledger} />}</LedgerScreen>;
}

function Dashboard({ ledger }: { ledger: Ledger }) {
  const router = useRouter();
  const userId = useUserId();
  const profile = useProfile(userId);
  const { totals, groups } = selectDashboard(ledger, userId);
  const activity = selectActivity(ledger, RECENT_ACTIVITY);
  const debts = selectMyDebts(ledger, userId);
  const firstName = profile.data?.displayName.trim().split(/\s+/)[0];

  // "Add expense" needs a group: go straight in when there is one, otherwise ask which.
  const addExpense = () => {
    if (groups.length === 1) {
      router.push({ pathname: '/groups/[id]/add-expense', params: { id: groups[0].group.id } });
    } else {
      router.push('/groups/pick');
    }
  };

  return (
    <>
      <FadeIn style={styles.greeting}>
        <Text variant="label" color={colors.inkSoft}>
          {greeting()} 👋
        </Text>
        <Text variant="title" accessibilityRole="header" numberOfLines={1}>
          {firstName ? `Kumusta, ${firstName}!` : 'Kumusta!'}
        </Text>
      </FadeIn>

      {groups.length === 0 ? (
        <FadeIn order={1}>
          <EmptyState
            emoji="🧾"
            title="Start your first hatian"
            body="Make a group for your barkada, trip or apartment, then add what everyone spent."
            action={<Button label="Create a group" onPress={() => router.push('/groups/create')} />}
          />
        </FadeIn>
      ) : (
        <>
          <FadeIn order={1}>
            <BalanceTicket
              totals={totals}
              caption={groups.length === 1 ? '1 group' : `${groups.length} groups`}
              empty={ledger.expenses.length === 0}
            />
          </FadeIn>

          <FadeIn order={2}>
            <Button
              label="Add expense"
              onPress={addExpense}
              icon={<Ionicons name="add" size={22} color={colors.ink} />}
            />
          </FadeIn>

          {debts.length > 0 ? (
            <FadeIn order={3}>
              <Section title="Who owes who">
                <RowGroup>
                  {debts.slice(0, TOP_DEBTS).map((debt) => {
                    const name =
                      findMember(debt.group, debt.personId)?.displayName ?? FORMER_MEMBER;
                    const direction = debt.amount > 0 ? 'owes you' : 'you owe';
                    return (
                      <Row
                        key={`${debt.group.id}-${debt.personId}`}
                        leading={<Avatar id={debt.personId} name={name} />}
                        title={name}
                        subtitle={`${direction} · ${debt.group.name}`}
                        trailing={<Amount centavos={debt.amount} tone="balance" signed />}
                        accessibilityLabel={`${debt.amount > 0 ? `${name} owes you` : `You owe ${name}`} ${formatPeso(Math.abs(debt.amount))} in ${debt.group.name}`}
                        onPress={() =>
                          router.push({
                            pathname: '/groups/[id]/balances',
                            params: { id: debt.group.id },
                          })
                        }
                      />
                    );
                  })}
                </RowGroup>
                {debts.length > TOP_DEBTS ? (
                  <Text variant="small" color={colors.inkSoft}>
                    And {debts.length - TOP_DEBTS} more. Open a group to see them all.
                  </Text>
                ) : null}
              </Section>
            </FadeIn>
          ) : null}

          <FadeIn order={4}>
            <Section
              title="Your groups"
              trailing={
                groups.length > RECENT_GROUPS ? (
                  <Button
                    label="See all"
                    variant="ghost"
                    compact
                    onPress={() => router.push('/groups')}
                  />
                ) : undefined
              }>
              <RowGroup>
                {groups.slice(0, RECENT_GROUPS).map((summary) => (
                  <GroupRow
                    key={summary.group.id}
                    summary={summary}
                    onPress={() =>
                      router.push({ pathname: '/groups/[id]', params: { id: summary.group.id } })
                    }
                  />
                ))}
              </RowGroup>
            </Section>
          </FadeIn>

          <FadeIn order={5}>
            <Section title="Recent activity">
              {activity.length === 0 ? (
                <View style={styles.quiet}>
                  <Text color={colors.inkSoft}>
                    Nothing yet. Add the first expense and it will show up here.
                  </Text>
                </View>
              ) : (
                <RowGroup>
                  {activity.map((item) => (
                    <ActivityRow
                      key={`${item.kind}-${item.id}`}
                      item={item}
                      viewerId={userId}
                      showGroup
                      onPress={() =>
                        item.kind === 'expense'
                          ? router.push({ pathname: '/expenses/[id]', params: { id: item.id } })
                          : router.push({
                              pathname: '/groups/[id]/balances',
                              params: { id: item.group.id },
                            })
                      }
                    />
                  ))}
                </RowGroup>
              )}
            </Section>
          </FadeIn>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  greeting: {
    gap: spacing.xs,
  },
  quiet: {
    paddingVertical: spacing.sm,
  },
});
