import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  /** Pads the top for the status bar. Use on screens without a navigation header. */
  safeTop?: boolean;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned below the scrolling content, above the keyboard. */
  footer?: ReactNode;
};

// Content never stretches wider than a phone, so tablets and web stay readable.
const MAX_WIDTH = 560;

export function Screen({
  children,
  safeTop,
  scroll = true,
  refreshing,
  onRefresh,
  footer,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = (safeTop ? insets.top : 0) + spacing.lg;
  const paddingBottom = footer ? spacing.lg : insets.bottom + spacing.xxl;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={safeTop ? 0 : 90}>
      {scroll ? (
        <ScrollView
          style={styles.root}
          contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.ink}
              />
            ) : undefined
          }>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, styles.content, { paddingTop, paddingBottom }]}>{children}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.footerInner}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  footer: {
    borderTopWidth: 1.5,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  footerInner: {
    width: '100%',
    maxWidth: MAX_WIDTH - spacing.xl * 2,
    alignSelf: 'center',
    gap: spacing.sm,
  },
});
