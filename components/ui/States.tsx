import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.ink} size="large" />
      <Text variant="small" color={colors.inkSoft}>
        {label}
      </Text>
    </View>
  );
}

type EmptyStateProps = {
  emoji: string;
  title: string;
  body: string;
  action?: ReactNode;
};

export function EmptyState({ emoji, title, body, action }: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text variant="heading" center>
        {title}
      </Text>
      <Text color={colors.inkSoft} center>
        {body}
      </Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
};

export function ErrorState({ message, onRetry, retrying }: ErrorStateProps) {
  return (
    <View style={styles.empty} accessibilityRole="alert">
      <Text style={styles.emoji}>😵‍💫</Text>
      <Text variant="heading" center>
        Ay, may problema
      </Text>
      <Text color={colors.inkSoft} center>
        {message}
      </Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button label="Try again" variant="secondary" onPress={onRetry} loading={retrying} />
        </View>
      ) : null}
    </View>
  );
}

/** Inline error under a form, announced to screen readers. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.formError} accessibilityRole="alert">
      <Text variant="small" color={colors.owe}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.paper,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emoji: {
    fontSize: 44,
    lineHeight: 56,
  },
  action: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  formError: {
    backgroundColor: colors.oweSoft,
    borderRadius: 12,
    padding: spacing.md,
  },
});
