import { StyleSheet, View } from 'react-native';

import { Card, Perforation } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { colors, radii, shadows, spacing, tabular, typography } from '@/constants/theme';
import type { UserTotals } from '@/features/balances/calculations';
import { formatPeso } from '@/lib/currency';

type BalanceTicketProps = {
  totals: UserTotals;
  /** What the totals cover, e.g. "3 groups". */
  caption: string;
  /** True when there are no expenses at all yet, as opposed to everything being paid back. */
  empty?: boolean;
};

// Tints of the owed/owe colours that stay readable on the ink background.
const OWED_ON_INK = colors.brand;
const OWE_ON_INK = '#FF9F88';
const RULE_ON_INK = '#243027';

/**
 * The one dark card on a screen: the net on top, then a dashed "hati" line, then the two halves:
 * what is coming to you and what you owe.
 */
export function BalanceTicket({ totals, caption, empty = false }: BalanceTicketProps) {
  const settled = totals.owed === 0 && totals.owes === 0;

  if (settled) {
    const headline = empty ? 'Nothing to split yet' : 'All settled ✨';
    const detail = empty
      ? 'Add an expense and your balance will show up here.'
      : 'Walang utang, walang singilan.';
    return (
      <View style={styles.shadow}>
        <Card tone="ink" style={styles.card}>
          <View accessible accessibilityLabel={`${caption}. ${headline}. ${detail}`}>
            <View style={styles.top}>
              <Text variant="label" color={colors.brand}>
                {empty ? 'Simula' : 'Kwits na'}
              </Text>
              <Text variant="label" color={colors.onInkMuted}>
                {caption}
              </Text>
            </View>
            <Text variant="title" color={colors.paper} style={styles.headline}>
              {headline}
            </Text>
            <Text variant="small" color={colors.onInkMuted}>
              {detail}
            </Text>
          </View>
        </Card>
      </View>
    );
  }

  const netColor = totals.net > 0 ? OWED_ON_INK : totals.net < 0 ? OWE_ON_INK : colors.paper;

  return (
    <View style={styles.shadow}>
      <Card tone="ink" style={styles.card}>
        <View
          accessible
          accessibilityLabel={`${caption}. You are owed ${formatPeso(totals.owed)} and you owe ${formatPeso(totals.owes)}. Net ${formatPeso(totals.net, { signed: true })}.`}>
          <View style={styles.top}>
            <Text variant="label" color={colors.brand}>
              Net
            </Text>
            <Text variant="label" color={colors.onInkMuted}>
              {caption}
            </Text>
          </View>
          <Text style={[styles.net, { color: netColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatPeso(totals.net, { compact: true, signed: true })}
          </Text>

          <Perforation lineColor={RULE_ON_INK} />

          <View style={styles.halves}>
            <View style={styles.half}>
              <Text variant="label" color={colors.onInkMuted}>
                You’re owed
              </Text>
              <Text
                style={[
                  styles.halfAmount,
                  { color: totals.owed > 0 ? OWED_ON_INK : colors.onInkMuted },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {formatPeso(totals.owed, { compact: true })}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.half}>
              <Text variant="label" color={colors.onInkMuted}>
                You owe
              </Text>
              <Text
                style={[
                  styles.halfAmount,
                  { color: totals.owes > 0 ? OWE_ON_INK : colors.onInkMuted },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {formatPeso(totals.owes, { compact: true })}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    ...shadows.raised,
    borderRadius: radii.lg,
  },
  card: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headline: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  net: {
    ...typography.hero,
    ...tabular,
    marginTop: spacing.sm,
  },
  halves: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  half: {
    flex: 1,
    gap: spacing.xs,
  },
  // Sized so "₱1,625.38" fits half a phone-width card without shrinking.
  halfAmount: {
    ...typography.amountLarge,
    fontSize: 22,
    lineHeight: 28,
  },
  divider: {
    width: 1.5,
    backgroundColor: RULE_ON_INK,
    marginHorizontal: spacing.lg,
  },
});
