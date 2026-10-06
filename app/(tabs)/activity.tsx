import { useRouter } from 'expo-router';

import { LedgerScreen } from '@/components/LedgerScreen';
import { ActivityRow, RowGroup } from '@/components/Rows';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useUserId } from '@/features/auth/AuthProvider';
import { selectActivity } from '@/features/ledger/selectors';

export default function ActivityScreen() {
  const router = useRouter();
  const userId = useUserId();

  return (
    <LedgerScreen safeTop>
      {(ledger) => {
        const items = selectActivity(ledger);
        return (
          <>
            <Text variant="title" accessibilityRole="header">
              Activity
            </Text>
            {items.length === 0 ? (
              <EmptyState
                emoji="🦗"
                title="Tahimik pa dito"
                body="Expenses and payments from all your groups will show up here."
              />
            ) : (
              <RowGroup>
                {items.map((item) => (
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
          </>
        );
      }}
    </LedgerScreen>
  );
}
