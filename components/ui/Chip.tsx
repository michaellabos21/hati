import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, outline, radii, spacing } from '@/constants/theme';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
  /** "radio" for pick-one groups, "checkbox" for pick-many. */
  role?: 'radio' | 'checkbox';
};

export function Chip({ label, selected, onPress, leading, role = 'radio' }: ChipProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}>
      {leading}
      <Text
        variant="smallBold"
        color={selected ? colors.white : colors.ink}
        numberOfLines={1}
        style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    ...outline,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '100%',
  },
  selected: {
    borderColor: colors.ink,
    backgroundColor: colors.ink,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    flexShrink: 1,
  },
});
