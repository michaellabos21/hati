import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LedgerScreen } from '@/components/LedgerScreen';
import { GroupRow, RowGroup } from '@/components/Rows';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useUserId } from '@/features/auth/AuthProvider';
import { selectDashboard } from '@/features/ledger/selectors';

/** Asks which group a new expense belongs to. Reached from Home when there are several. */
export default function PickGroupScreen() {
  const router = useRouter();
  const userId = useUserId();

  return (
    <LedgerScreen>
      {(ledger) => {
        const { groups } = selectDashboard(ledger, userId);
        if (groups.length === 0) {
          return (
            <EmptyState
              emoji="👯"
              title="No groups yet"
              body="Create a group first, then add what everyone spent."
              action={
                <Button label="Create a group" onPress={() => router.replace('/groups/create')} />
              }
            />
          );
        }
        return (
          <>
            <View style={styles.heading}>
              <Text variant="title" accessibilityRole="header">
                Para saan?
              </Text>
              <Text color={colors.inkSoft}>Pick the group this expense belongs to.</Text>
            </View>
            <RowGroup>
              {groups.map((summary) => (
                <GroupRow
                  key={summary.group.id}
                  summary={summary}
                  onPress={() =>
                    // Replace, so Back from the expense form returns to where the user started.
                    router.replace({
                      pathname: '/groups/[id]/add-expense',
                      params: { id: summary.group.id },
                    })
                  }
                />
              ))}
            </RowGroup>
          </>
        );
      }}
    </LedgerScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xs,
  },
});
