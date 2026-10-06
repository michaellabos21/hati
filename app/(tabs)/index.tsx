import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { APP_NAME, APP_TAGLINE } from '@/constants/app';
import { colors, spacing, typography } from '@/constants/theme';

// Launch placeholder. The real dashboard (balances, groups, activity) is TASK 016.
export default function HomeScreen() {
  return (
    <Screen centered>
      <Text style={styles.name}>{APP_NAME} 🇵🇭</Text>
      <View style={styles.tagline}>
        {APP_TAGLINE.map((line) => (
          <Text key={line} style={styles.taglineLine}>
            {line}
          </Text>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: {
    ...typography.display,
    color: colors.primaryDark,
  },
  tagline: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  taglineLine: {
    ...typography.heading,
    color: colors.textMuted,
  },
});
