import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { logIn } from '@/features/auth/api';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo/sampleData';
import { toMessage } from '@/lib/errors';
import { DEMO_MODE } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // On success the auth guard swaps this screen for the app; nothing to navigate.
  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      await logIn(values);
    } catch (caught) {
      setError(toMessage(caught));
    }
  });

  return (
    <Screen>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          Welcome back
        </Text>
        <Text color={colors.inkSoft}>
          {DEMO_MODE
            ? `Demo mode: use ${DEMO_EMAIL} with the password “${DEMO_PASSWORD}”.`
            : 'Log in to see who owes what.'}
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
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field
              ref={passwordRef}
              label="Password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}
        />
        <FormError message={error} />
        <Button label="Log in" onPress={submit} loading={formState.isSubmitting} />
        <Button
          label="New here? Create an account"
          variant="ghost"
          onPress={() => router.replace('/auth/signup')}
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
