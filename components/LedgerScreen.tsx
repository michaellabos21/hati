import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DemoBanner } from '@/components/DemoBanner';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { useLedger, usePullToRefresh } from '@/features/ledger/useLedger';
import { toMessage } from '@/lib/errors';
import type { Ledger } from '@/types/domain';

type LedgerScreenProps = {
  safeTop?: boolean;
  children: (ledger: Ledger) => ReactNode;
  footer?: (ledger: Ledger) => ReactNode;
  /**
   * Once loaded, render the children on their own instead of inside a Screen. For forms that
   * need to own the Screen so their pinned footer can read the form's state.
   */
  bare?: boolean;
};

/**
 * Wraps a screen that needs the ledger: shows loading and error states, supports pull to
 * refresh, and keeps showing the last good data (with a notice) if a refresh fails.
 */
export function LedgerScreen({ safeTop, children, footer, bare }: LedgerScreenProps) {
  const ledger = useLedger();
  const queryClient = useQueryClient();
  // Pulling down refreshes everything on screen (the ledger, invites, profile), not just the ledger.
  const { refreshing, onRefresh } = usePullToRefresh(() =>
    queryClient.refetchQueries({ type: 'active' }),
  );

  if (ledger.data === undefined) {
    return (
      <Screen safeTop={safeTop}>
        {ledger.isError ? (
          <ErrorState
            message={toMessage(ledger.error)}
            onRetry={() => ledger.refetch()}
            retrying={ledger.isFetching}
          />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  if (bare) return <>{children(ledger.data)}</>;

  return (
    <Screen
      safeTop={safeTop}
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={footer?.(ledger.data)}>
      <DemoBanner />
      {ledger.isError ? (
        <View style={styles.stale} accessibilityRole="alert">
          <Text variant="small">
            Could not refresh, so this may be out of date. Pull down to try again.
          </Text>
        </View>
      ) : null}
      {children(ledger.data)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stale: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
});
