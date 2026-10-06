import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/Text';
import {
  colors,
  fonts,
  noFocusRing,
  radii,
  spacing,
  tabular,
  TOUCH_TARGET,
} from '@/constants/theme';

export type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  /** Shown before the input, e.g. the peso sign. */
  prefix?: string;
  /** For amounts and phone numbers: bold tabular figures. */
  numeric?: boolean;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, hint, prefix, numeric, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text variant="smallBold">{label}</Text>
      <View style={[styles.box, focused && styles.focused, !!error && styles.invalid]}>
        {prefix ? (
          <Text variant="amount" color={colors.inkSoft}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.inkFaint}
          selectionColor={colors.ink}
          {...rest}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, numeric && styles.numeric, style]}
        />
      </View>
      {error ? (
        <Text variant="small" color={colors.owe} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color={colors.inkSoft}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs + 2,
  },
  box: {
    // The border keeps one width in every state so focusing never shifts the layout.
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    minHeight: TOUCH_TARGET + 4,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  focused: {
    borderColor: colors.ink,
  },
  invalid: {
    borderColor: colors.owe,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: spacing.md,
    // Lets the input shrink inside its row on web instead of forcing a minimum width.
    minWidth: 0,
    ...noFocusRing,
  },
  numeric: {
    fontFamily: fonts.bodyBold,
    ...tabular,
  },
});
