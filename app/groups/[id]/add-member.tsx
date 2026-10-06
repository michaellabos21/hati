import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { GroupGate } from '@/components/GroupGate';
import { InviteLinkSection } from '@/components/InviteLinkSection';
import { Row, RowGroup } from '@/components/Rows';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Section } from '@/components/ui/Section';
import { FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { emailSchema, type EmailValues } from '@/features/auth/schemas';
import { useGroupInvites, useInviteMember, useWithdrawInvite } from '@/features/invites/api';
import type { GroupView } from '@/features/ledger/selectors';
import { relativeTime } from '@/lib/dates';
import { toMessage } from '@/lib/errors';

export default function InviteMemberScreen() {
  const router = useRouter();
  return (
    <GroupGate
      footer={() => <Button label="Done" variant="secondary" onPress={() => router.back()} />}>
      {(view, userId) => <InviteMember view={view} userId={userId} />}
    </GroupGate>
  );
}

function InviteMember({ view, userId }: { view: GroupView; userId: string }) {
  const { group } = view;
  const invite = useInviteMember(
    group.id,
    group.members.map((member) => member.id),
  );
  const withdraw = useWithdrawInvite(group.id);
  const pending = useGroupInvites(group.id);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(({ email }) => {
    setSentTo(null);
    setFormError(null);
    invite.mutate(email, {
      onSuccess: (name) => {
        setSentTo(name);
        reset({ email: '' });
      },
      onError: (caught) => setFormError(toMessage(caught)),
    });
  });

  return (
    <>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          Invite to {group.name}
        </Text>
        <Text color={colors.inkSoft}>
          Enter the email they use for HATI. They get an invite on their Home screen and join only
          if they accept.
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
              returnKeyType="send"
              onSubmitEditing={submit}
            />
          )}
        />
        <FormError message={formError} />
        {sentTo ? (
          <View style={styles.success} accessibilityLiveRegion="polite">
            <Text variant="smallBold" color={colors.owed}>
              Invite sent to {sentTo} 🎉 They can be added to expenses once they accept.
            </Text>
          </View>
        ) : null}
        <Button label="Send invite" onPress={submit} loading={invite.isPending} />
      </View>

      <InviteLinkSection groupId={group.id} groupName={group.name} />

      {pending.data && pending.data.length > 0 ? (
        <Section title={`Waiting to accept · ${pending.data.length}`}>
          <RowGroup>
            {pending.data.map((item) => (
              <Row
                key={item.id}
                leading={<Avatar id={item.userId} name={item.displayName} />}
                title={item.displayName}
                subtitle={`Invited ${relativeTime(item.createdAt).toLowerCase()}`}
                trailing={
                  <Button
                    label="Withdraw"
                    variant="ghost"
                    compact
                    disabled={withdraw.isPending}
                    accessibilityHint={`Cancel the invite to ${item.displayName}`}
                    onPress={() => withdraw.mutate(item.id)}
                  />
                }
                accessibilityLabel={`${item.displayName}, invited, waiting to accept`}
              />
            ))}
          </RowGroup>
          <FormError message={withdraw.isError ? toMessage(withdraw.error) : null} />
        </Section>
      ) : null}
      {pending.isError ? (
        <Text variant="small" color={colors.inkSoft}>
          Could not load pending invites. Pull down to try again.
        </Text>
      ) : null}

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
