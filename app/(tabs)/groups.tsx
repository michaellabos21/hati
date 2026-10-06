import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LedgerScreen } from '@/components/LedgerScreen';
import { GroupRow, RowGroup } from '@/components/Rows';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useUserId } from '@/features/auth/AuthProvider';
import { selectDashboard } from '@/features/ledger/selectors';

export default function GroupsScreen() {
  const router = useRouter();
  const userId = useUserId();

  return (
    <LedgerScreen safeTop>
      {(ledger) => {
        const { groups } = selectDashboard(ledger, userId);
        return (
          <>
            <View style={styles.header}>
              <Text variant="title" accessibilityRole="header">
                Groups
              </Text>
              <Button
                label="New"
                compact
                onPress={() => router.push('/groups/create')}
                icon={<Ionicons name="add" size={18} color={colors.ink} />}
                accessibilityHint="Create a new group"
              />
            </View>

            {groups.length === 0 ? (
              <EmptyState
                emoji="👯"
                title="No groups yet"
                body="A group is anyone you split with: your barkada, a trip, your apartment, a school project."
                action={
                  <Button label="Create a group" onPress={() => router.push('/groups/create')} />
                }
              />
            ) : (
              <RowGroup>
                {groups.map((summary) => (
                  <GroupRow
                    key={summary.group.id}
                    summary={summary}
                    onPress={() =>
                      router.push({ pathname: '/groups/[id]', params: { id: summary.group.id } })
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
