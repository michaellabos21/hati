import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, outline, radii, shadows, spacing } from '@/constants/theme';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  tone?: 'surface' | 'ink';
};

export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
  tone = 'surface',
}: CardProps) {
  const base = [styles.card, tone === 'ink' ? styles.ink : styles.surface, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...base, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

/**
 * A dashed rule between two blocks inside a Card: the "hati" line where something is split.
 * It bleeds to the card's edges.
 */
export function Perforation({ lineColor = colors.line }: { lineColor?: string }) {
  return (
    <View style={styles.perforation} accessibilityElementsHidden importantForAccessibility="no">
      {Array.from({ length: 48 }, (_, index) => (
        <View key={index} style={[styles.dash, { backgroundColor: lineColor }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  surface: {
    ...outline,
    ...shadows.card,
    backgroundColor: colors.surface,
  },
  ink: {
    backgroundColor: colors.ink,
  },
  pressed: {
    opacity: 0.85,
  },
  perforation: {
    flexDirection: 'row',
    gap: 5,
    marginHorizontal: -spacing.lg,
    marginVertical: spacing.lg,
    overflow: 'hidden',
  },
  dash: {
    width: 6,
    height: 1.5,
    borderRadius: 1,
  },
});
