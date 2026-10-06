import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { signUp } from '@/features/auth/api';
import { signupSchema, type SignupValues } from '@/features/auth/schemas';
import { toMessage } from '@/lib/errors';

export default function SignupScreen() {
  const router = useRouter();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const { needsEmailConfirmation } = await signUp(values);
      // With confirmation off, a session now exists and the auth guard opens the app.
      if (needsEmailConfirmation) setConfirmEmail(values.email);
    } catch (caught) {
      setError(toMessage(caught));
    }
  });

  if (confirmEmail) {
    return (
      <Screen>
        <EmptyState
          emoji="📬"
          title="Check your email"
          body={`We sent a confirmation link to ${confirmEmail}. Open it, then come back and log in.`}
          action={<Button label="Go to log in" onPress={() => router.replace('/auth/login')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          Create your profile
        </Text>
        <Text color={colors.inkSoft}>Your barkada will see this name on shared expenses.</Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="displayName"
          render={({ field, fieldState }) => (
            <Field
              label="Name"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              placeholder="Michael"
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              ref={emailRef}
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              hint="Friends add you to groups with this email."
              placeholder="michael@email.com"
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
              hint="At least 8 characters."
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}
        />
        <FormError message={error} />
        <Button label="Create account" onPress={submit} loading={formState.isSubmitting} />
        <Button
          label="I already have an account"
          variant="ghost"
          onPress={() => router.replace('/auth/login')}
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
