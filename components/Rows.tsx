import { Ionicons } from '@expo/vector-icons';
import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Amount } from '@/components/ui/Amount';
import { Text } from '@/components/ui/Text';
import { colors, outline, radii, shadows, spacing } from '@/constants/theme';
import { expenseEmoji, groupEmoji } from '@/features/groups/emoji';
import {
  expenseImpact,
  nameOf,
  type ActivityItem,
  type GroupSummary,
} from '@/features/ledger/selectors';
import { formatPeso } from '@/lib/currency';
import { relativeTime } from '@/lib/dates';

type RowProps = {
  leading: ReactNode;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
};

/** One line in a list: badge, two lines of text, something on the right. */
export function Row({ leading, title, subtitle, trailing, onPress, accessibilityLabel }: RowProps) {
  const content = (
    <>
      {leading}
      <View style={styles.text}>
        <Text variant="bodyBold" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="small" color={colors.inkSoft} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

export function EmojiBadge({ emoji, tone = colors.paperDeep }: { emoji: string; tone?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: tone }]}>
      <Text style={styles.badgeEmoji}>{emoji}</Text>
    </View>
  );
}

/** Groups rows visually into one outlined block with hairlines between them. */
export function RowGroup({ children }: { children: ReactNode }) {
  return (
    <View style={styles.group}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={index > 0 && styles.separator}>
          {child}
        </View>
      ))}
    </View>
  );
}

function impactLabel(impact: number) {
  if (impact > 0) return `you lent ${formatPeso(impact, { compact: true })}`;
  if (impact < 0) return `you owe ${formatPeso(-impact, { compact: true })}`;
  return 'not involved';
}

type ActivityRowProps = {
  item: ActivityItem;
  viewerId: string;
  /** Show which group it belongs to (for lists that mix groups). */
  showGroup?: boolean;
  onPress?: () => void;
};

export function ActivityRow({ item, viewerId, showGroup, onPress }: ActivityRowProps) {
  const when = relativeTime(item.createdAt);
  const where = showGroup ? ` · ${item.group.name}` : '';

  if (item.kind === 'settlement') {
    const { settlement, group } = item;
    const from = nameOf(group, settlement.from, viewerId);
    const to = nameOf(group, settlement.to, viewerId).replace(/^You$/, 'you');
    const title = `${from} paid ${to}`;
    return (
      <Row
        leading={<EmojiBadge emoji="💸" tone={colors.owedSoft} />}
        title={title}
        subtitle={`${when}${where}`}
        trailing={<Amount centavos={settlement.amount} />}
        onPress={onPress}
        accessibilityLabel={`${title} ${formatPeso(settlement.amount)}, ${when}${where}`}
      />
    );
  }

  const { expense, group } = item;
  const impact = expenseImpact(expense, viewerId);
  const payer = nameOf(group, expense.paidBy, viewerId);
  const subtitle = `${payer} paid ${formatPeso(expense.amount, { compact: true })}${where}`;
  return (
    <Row
      leading={<EmojiBadge emoji={expenseEmoji(expense.description)} />}
      title={expense.description}
      subtitle={subtitle}
      trailing={
        <>
          <Amount centavos={impact} tone="balance" signed />
          <Text variant="small" color={colors.inkFaint}>
            {when}
          </Text>
        </>
      }
      onPress={onPress}
      accessibilityLabel={`${expense.description}. ${subtitle}, ${impactLabel(impact)}, ${when}`}
    />
  );
}

/** Short status for a group row; the amount itself is shown separately on the right. */
function netWord(net: number) {
  if (net > 0) return 'you’re owed';
  if (net < 0) return 'you owe';
  return 'settled up';
}

export function GroupRow({ summary, onPress }: { summary: GroupSummary; onPress: () => void }) {
  const { group, net } = summary;
  const members = `${group.members.length} ${group.members.length === 1 ? 'member' : 'members'}`;
  return (
    <Row
      leading={<EmojiBadge emoji={groupEmoji(group.name)} tone={colors.brandSoft} />}
      title={group.name}
      subtitle={`${members} · ${netWord(net)}`}
      trailing={
        net === 0 ? (
          <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
        ) : (
          <Amount centavos={net} tone="balance" signed />
        )
      }
      onPress={onPress}
      accessibilityLabel={`${group.name}, ${members}, ${netWord(net)}${net === 0 ? '' : ` ${formatPeso(Math.abs(net))}`}`}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 64,
  },
  pressed: {
    backgroundColor: colors.paperDeep,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 2,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontSize: 20,
    lineHeight: 26,
  },
  group: {
    ...outline,
    ...shadows.card,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  separator: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
