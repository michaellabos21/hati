import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { DEMO_MODE } from '@/lib/supabase';

/** Shown on every data screen in demo mode, so sample data is never mistaken for real money. */
export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text variant="smallBold">Demo mode</Text>
      <Text variant="small" color={colors.inkSoft} style={styles.detail}>
        Sample data. Changes reset when you reload.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.sm,
    backgroundColor: colors.brandSoft,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  detail: {
    flexShrink: 1,
  },
});
