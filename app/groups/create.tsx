import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { groupFormSchema, useCreateGroup, type GroupValues } from '@/features/groups/api';
import { groupEmoji } from '@/features/groups/emoji';
import { toMessage } from '@/lib/errors';

const IDEAS = ['Barkada', 'Boracay Trip', 'Apartment', 'Research Project'];

export default function CreateGroupScreen() {
  const router = useRouter();
  const create = useCreateGroup();
  const { control, handleSubmit, setValue } = useForm<GroupValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: { name: '', description: '' },
  });
  const name = useWatch({ control, name: 'name' });

  const submit = handleSubmit((values) => {
    create.mutate(values, {
      // Replace, so Back from the new group does not return to this form.
      onSuccess: (id) => router.replace({ pathname: '/groups/[id]', params: { id } }),
    });
  });

  return (
    <Screen footer={<Button label="Create group" onPress={submit} loading={create.isPending} />}>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          {name.trim() ? `${groupEmoji(name)} ${name.trim()}` : 'Sino-sino kayo?'}
        </Text>
        <Text color={colors.inkSoft}>Name the group. You can add people right after.</Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <Field
              label="Group name"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              placeholder="Boracay 2026"
              autoCapitalize="words"
              autoFocus
              maxLength={80}
              returnKeyType="next"
            />
          )}
        />
        <View style={styles.ideas} accessibilityRole="radiogroup" accessibilityLabel="Name ideas">
          {IDEAS.map((idea) => (
            <Chip
              key={idea}
              label={`${groupEmoji(idea)} ${idea}`}
              selected={name.trim() === idea}
              onPress={() => setValue('name', idea, { shouldValidate: true, shouldDirty: true })}
            />
          ))}
        </View>
        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <Field
              label="Description (optional)"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              placeholder="Summer trip with the barkada"
              maxLength={280}
            />
          )}
        />
        <FormError message={create.isError ? toMessage(create.error) : null} />
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
  ideas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
