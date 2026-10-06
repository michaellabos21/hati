import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { GroupGate } from '@/components/GroupGate';
import { Row, RowGroup } from '@/components/Rows';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Section } from '@/components/ui/Section';
import { FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { emailSchema, type EmailValues } from '@/features/auth/schemas';
import { useAddMember } from '@/features/groups/api';
import type { GroupView } from '@/features/ledger/selectors';
import { toMessage } from '@/lib/errors';

export default function AddMemberScreen() {
  const router = useRouter();
  return (
    <GroupGate
      footer={() => <Button label="Done" variant="secondary" onPress={() => router.back()} />}>
      {(view, userId) => <AddMember view={view} userId={userId} />}
    </GroupGate>
  );
}

function AddMember({ view, userId }: { view: GroupView; userId: string }) {
  const { group } = view;
  const add = useAddMember(group.id);
  const [added, setAdded] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(({ email }) => {
    setAdded(null);
    add.mutate(email, {
      onSuccess: (name) => {
        setAdded(name);
        reset({ email: '' });
      },
    });
  });

  return (
    <>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          Add to {group.name}
        </Text>
        <Text color={colors.inkSoft}>
          Enter the email they signed up to HATI with. They need an account first.
        </Text>
      </View>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              label="Their email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              placeholder="juan@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          )}
        />
        <FormError message={add.isError ? toMessage(add.error) : null} />
        {added ? (
          <View style={styles.success} accessibilityLiveRegion="polite">
            <Text variant="smallBold" color={colors.owed}>
              {added} is in! 🎉 Add someone else, or tap Done.
            </Text>
          </View>
        ) : null}
        <Button label="Add member" onPress={submit} loading={add.isPending} />
      </View>

      <Section title={`In this group · ${group.members.length}`}>
        <RowGroup>
          {group.members.map((member) => {
            const name = member.id === userId ? `${member.displayName} (you)` : member.displayName;
            return (
              <Row
                key={member.id}
                leading={<Avatar id={member.id} name={member.displayName} />}
                title={name}
                subtitle="Member"
                accessibilityLabel={name}
              />
            );
          })}
        </RowGroup>
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xs,
  },
  form: {
    gap: spacing.lg,
  },
  success: {
    backgroundColor: colors.owedSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
});
