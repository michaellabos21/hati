import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, spacing, typography } from '@/constants/theme';

type PlaceholderScreenProps = {
  title: string;
  /** The MVP_PLAN.md task that will implement this screen. */
  task: string;
};

// Navigation-shell stub. Replaced screen by screen as each task lands.
export function PlaceholderScreen({ title, task }: PlaceholderScreenProps) {
  return (
    <Screen centered>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>Coming in {task}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
