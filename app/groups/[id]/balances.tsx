import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GroupGate } from '@/components/GroupGate';
import { ActivityRow, Row, RowGroup } from '@/components/Rows';
import { Amount } from '@/components/ui/Amount';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, Perforation } from '@/components/ui/Card';
import { FadeIn } from '@/components/ui/FadeIn';
import { Section } from '@/components/ui/Section';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import type { Transfer } from '@/features/balances/calculations';
import { FORMER_MEMBER } from '@/features/ledger/schema';
import { findMember, nameOf, type GroupView } from '@/features/ledger/selectors';
import { formatPeso } from '@/lib/currency';

export default function BalancesScreen() {
  const router = useRouter();
  return (
    <GroupGate
      footer={(view) =>
        view.group.members.length > 1 ? (
          <Button
            label="Record a payment"
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/groups/[id]/settle', params: { id: view.group.id } })
            }
          />
        ) : null
      }>
      {(view, userId) => <Balances view={view} userId={userId} />}
    </GroupGate>
  );
}

function TransferCard({
  transfer,
  view,
  userId,
}: {
  transfer: Transfer;
  view: GroupView;
  userId: string;
}) {
  const router = useRouter();
  const { group } = view;
  const id = group.id;
  const from = nameOf(group, transfer.from, userId);
  const to = nameOf(group, transfer.to, userId);
  const iPay = transfer.from === userId;
  const iReceive = transfer.to === userId;
  const sentence = iPay ? `You pay ${to}` : iReceive ? `${from} pays you` : `${from} pays ${to}`;

  return (
    <Card>
      <View
        style={styles.transferTop}
        accessible
        accessibilityLabel={`${sentence} ${formatPeso(transfer.amount)}`}>
        <View style={styles.people}>
          <Avatar
            id={transfer.from}
            name={findMember(group, transfer.from)?.displayName ?? FORMER_MEMBER}
            size={36}
          />
          <Ionicons name="arrow-forward" size={18} color={colors.inkSoft} />
          <Avatar
            id={transfer.to}
            name={findMember(group, transfer.to)?.displayName ?? FORMER_MEMBER}
            size={36}
          />
        </View>
        <Amount
          centavos={iPay ? -transfer.amount : transfer.amount}
          tone={iPay || iReceive ? 'balance' : 'neutral'}
          large
        />
      </View>
      <Text variant="bodyBold" style={styles.sentence}>
        {sentence}
      </Text>

      {iPay || iReceive ? (
        <>
          <Perforation />
          <View style={styles.actions}>
            {iReceive ? (
              <Button
                label="Paki-GCash 😭"
                style={styles.action}
                accessibilityHint={`Write a payment reminder for ${from}`}
                onPress={() =>
                  router.push({
                    pathname: '/groups/[id]/remind',
                    params: { id, to: transfer.from, amount: String(transfer.amount) },
                  })
                }
              />
            ) : null}
            <Button
              label={iPay ? 'Mark as paid' : 'Mark received'}
              variant={iPay ? 'primary' : 'secondary'}
              style={styles.action}
              accessibilityHint={
                iPay ? `Record that you paid ${to}` : `Record that ${from} paid you`
              }
              onPress={() =>
                router.push({
                  pathname: '/groups/[id]/settle',
                  params: {
                    id,
                    mode: iPay ? 'pay' : 'receive',
                    other: iPay ? transfer.to : transfer.from,
                    amount: String(transfer.amount),
                  },
                })
              }
            />
          </View>
        </>
      ) : null}
    </Card>
  );
}

function Balances({ view, userId }: { view: GroupView; userId: string }) {
  const { group, balances, transfers, settlements, expenses } = view;
  // My own payments first, since those are the ones I can act on.
  const ordered = [...transfers].sort((a, b) => {
    const mine = (t: Transfer) => (t.from === userId || t.to === userId ? 0 : 1);
    return mine(a) - mine(b);
  });

  return (
    <>
      <FadeIn>
        <Text variant="title" accessibilityRole="header">
          Sino may utang?
        </Text>
        <Text color={colors.inkSoft}>
          {transfers.length === 0
            ? 'Nobody owes anybody right now.'
            : `${transfers.length} ${transfers.length === 1 ? 'payment settles' : 'payments settle'} everything in ${group.name}.`}
        </Text>
      </FadeIn>

      {transfers.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title="Kwits na kayo"
          body={
            expenses.length === 0
              ? 'Add an expense and HATI will work out who pays whom.'
              : 'Everyone is settled up. Walang utang, walang away.'
          }
        />
      ) : (
        <View style={styles.transfers}>
          {ordered.map((transfer, index) => (
            <FadeIn key={`${transfer.from}-${transfer.to}`} order={index + 1}>
              <TransferCard transfer={transfer} view={view} userId={userId} />
            </FadeIn>
          ))}
        </View>
      )}

      <Section title="Everyone’s balance">
        <RowGroup>
          {Object.entries(balances)
            .sort(([, a], [, b]) => b - a)
            .map(([memberId, net]) => {
              const displayName = findMember(group, memberId)?.displayName ?? FORMER_MEMBER;
              const name = memberId === userId ? `${displayName} (you)` : displayName;
              const status = net > 0 ? 'gets back' : net < 0 ? 'owes' : 'settled up';
              return (
                <Row
                  key={memberId}
                  leading={<Avatar id={memberId} name={displayName} />}
                  title={name}
                  subtitle={status}
                  trailing={
                    net === 0 ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.owed} />
                    ) : (
                      <Amount centavos={net} tone="balance" signed />
                    )
                  }
                  accessibilityLabel={`${name} ${status}${net === 0 ? '' : ` ${formatPeso(Math.abs(net))}`}`}
                />
              );
            })}
        </RowGroup>
      </Section>

      <Section title="Payment history">
        {settlements.length === 0 ? (
          <Text color={colors.inkSoft}>No payments recorded yet.</Text>
        ) : (
          <RowGroup>
            {settlements.map((settlement) => (
              <ActivityRow
                key={settlement.id}
                item={{
                  kind: 'settlement',
                  id: settlement.id,
                  createdAt: settlement.createdAt,
                  group,
                  settlement,
                }}
                viewerId={userId}
              />
            ))}
          </RowGroup>
        )}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  transfers: {
    gap: spacing.md,
  },
  transferTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  people: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sentence: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
});
