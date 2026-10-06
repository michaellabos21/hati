import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { ErrorState, FormError, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { logOut, useProfile, useUpdateProfile } from '@/features/auth/api';
import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { profileFormSchema, type ProfileValues } from '@/features/auth/schemas';
import { confirm } from '@/lib/confirm';
import { toMessage } from '@/lib/errors';

export default function ProfileScreen() {
  const userId = useUserId();
  const { session } = useAuth();
  const profile = useProfile(userId);
  const update = useUpdateProfile(userId);
  const [saved, setSaved] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const { control, handleSubmit, reset, formState } = useForm({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { displayName: '', gcashNumber: '', mayaNumber: '' },
  });

  // Fill the form once the profile arrives, and again after each save.
  useEffect(() => {
    if (profile.data) {
      reset({
        displayName: profile.data.displayName,
        gcashNumber: profile.data.gcashNumber ?? '',
        mayaNumber: profile.data.mayaNumber ?? '',
      });
    }
  }, [profile.data, reset]);

  const save = handleSubmit((values: ProfileValues) => {
    setSaved(false);
    update.mutate(values, { onSuccess: () => setSaved(true) });
  });

  const onLogOut = async () => {
    const yes = await confirm({
      title: 'Log out?',
      message: 'Your groups and balances stay safe. Log back in any time.',
      confirmLabel: 'Log out',
    });
    if (!yes) return;
    try {
      await logOut();
    } catch (caught) {
      setLogoutError(toMessage(caught));
    }
  };

  if (profile.data === undefined) {
    return (
      <Screen safeTop>
        {profile.isError ? (
          <>
            <ErrorState
              message={toMessage(profile.error)}
              onRetry={() => profile.refetch()}
              retrying={profile.isFetching}
            />
            <Button label="Log out" variant="secondary" onPress={onLogOut} />
          </>
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  return (
    <Screen safeTop>
      <View style={styles.identity}>
        <Avatar id={userId} name={profile.data.displayName} size={64} />
        <View style={styles.identityText}>
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {profile.data.displayName}
          </Text>
          <Text color={colors.inkSoft} numberOfLines={1}>
            {session?.user.email}
          </Text>
        </View>
      </View>

      <Section title="Your details">
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
                autoCapitalize="words"
              />
            )}
          />
          <Controller
            control={control}
            name="gcashNumber"
            render={({ field, fieldState }) => (
              <Field
                label="GCash number"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                hint="Optional. Added to reminders you send, so friends know where to pay."
                placeholder="09XXXXXXXXX"
                keyboardType="phone-pad"
                numeric
              />
            )}
          />
          <Controller
            control={control}
            name="mayaNumber"
            render={({ field, fieldState }) => (
              <Field
                label="Maya number"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                hint="Optional. Your numbers are private: only you can see them here."
                placeholder="09XXXXXXXXX"
                keyboardType="phone-pad"
                numeric
              />
            )}
          />
          <FormError message={update.isError ? toMessage(update.error) : null} />
          {saved && !formState.isDirty ? (
            <Text variant="smallBold" color={colors.owed} accessibilityLiveRegion="polite">
              Saved ✓
            </Text>
          ) : null}
          <Button
            label="Save changes"
            onPress={save}
            loading={update.isPending}
            disabled={!formState.isDirty}
          />
        </View>
      </Section>

      <View style={styles.form}>
        <FormError message={logoutError} />
        <Button label="Log out" variant="secondary" onPress={onLogOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identityText: {
    flex: 1,
  },
  form: {
    gap: spacing.lg,
  },
});
