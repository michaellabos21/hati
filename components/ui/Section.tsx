import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';

type SectionProps = {
  title: string;
  /** Small control on the right of the heading, e.g. a "See all" button. */
  trailing?: ReactNode;
  children: ReactNode;
};

export function Section({ title, trailing, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="bodyBold" accessibilityRole="header">
          {title}
        </Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
});
