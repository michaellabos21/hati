import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  centered?: boolean;
};

export function Screen({ children, centered = false }: ScreenProps) {
  return <View style={[styles.container, centered && styles.centered]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
