import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, outline, radii, shadows, spacing, TOUCH_TARGET } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  compact?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
};

const FILL: Record<Variant, string> = {
  primary: colors.brand,
  secondary: colors.surface,
  ghost: 'transparent',
  danger: colors.oweSoft,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  compact = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  const raised = variant === 'primary' && !inactive;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        (variant === 'secondary' || variant === 'danger') && outline,
        variant === 'danger' && styles.dangerBorder,
        { backgroundColor: FILL[variant] },
        raised && shadows.primary,
        pressed && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            variant={compact ? 'smallBold' : 'bodyBold'}
            color={variant === 'danger' ? colors.owe : colors.ink}
            numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  dangerBorder: {
    borderColor: colors.oweSoft,
  },
  inactive: {
    opacity: 0.45,
  },
});
