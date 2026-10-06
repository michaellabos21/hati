import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { requestPasswordReset } from '@/features/auth/api';
import { emailSchema, type EmailValues } from '@/features/auth/schemas';
import { toMessage } from '@/lib/errors';
import { DEMO_MODE } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
    } catch (caught) {
      setError(toMessage(caught));
    }
  });

  if (sentTo) {
    return (
      <Screen>
        <EmptyState
          emoji="📬"
          title="Check your email"
          body={
            DEMO_MODE
              ? 'Demo mode does not send email. On the real app, a reset link would be on its way.'
              : `If ${sentTo} has a HATI account, a link to set a new password is on its way. It can take a minute, and may land in spam.`
          }
          action={<Button label="Back to log in" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          Forgot your password?
        </Text>
        <Text color={colors.inkSoft}>
          Enter your email and we’ll send you a link to set a new one.
        </Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              placeholder="juan@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={submit}
            />
          )}
        />
        <FormError message={error} />
        <Button label="Send reset link" onPress={submit} loading={formState.isSubmitting} />
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
