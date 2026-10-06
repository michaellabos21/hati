import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { logOut, setNewPassword } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { newPasswordSchema, type NewPasswordValues } from '@/features/auth/schemas';
import { toMessage } from '@/lib/errors';

/**
 * Shown instead of the app after someone follows a password-reset link. The link signs them
 * in; this makes them choose the new password before going any further.
 */
export function NewPasswordScreen() {
  const { session, finishRecovery } = useAuth();
  const confirmRef = useRef<TextInput>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const submit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await setNewPassword(password);
      finishRecovery();
    } catch (caught) {
      setError(toMessage(caught));
    }
  });

  // The link was already used, or it expired, so it did not sign anyone in.
  if (!session) {
    return (
      <Screen safeTop>
        <EmptyState
          emoji="⌛"
          title="This reset link has expired"
          body="Reset links work once and only for a short time. Ask for a new one from the log in screen."
          action={<Button label="Back to HATI" onPress={finishRecovery} />}
        />
      </Screen>
    );
  }

  return (
    <Screen safeTop>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          Set a new password
        </Text>
        <Text color={colors.inkSoft}>For {session.user.email}</Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field
              label="New password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              hint="At least 8 characters."
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="confirm"
          render={({ field, fieldState }) => (
            <Field
              ref={confirmRef}
              label="Type it again"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}
        />
        <FormError message={error} />
        <Button label="Save new password" onPress={submit} loading={formState.isSubmitting} />
        <Button
          label="Cancel and log out"
          variant="ghost"
          onPress={() => {
            // Leaving without choosing a password must not leave them signed in via the link.
            logOut().catch(() => {});
            finishRecovery();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xs,
  },
  form: {
    gap: spacing.lg,
  },
});
