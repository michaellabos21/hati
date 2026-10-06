import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState, FormError, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { groupEmoji } from '@/features/groups/emoji';
import {
  isInviteToken,
  rememberInviteToken,
  takeRememberedInviteToken,
  useInviteLinkInfo,
  useJoinWithLink,
} from '@/features/invites/links';
import { toMessage } from '@/lib/errors';

/** Where an invite link lands. Open to signed-out visitors, who are asked to sign up first. */
export default function JoinScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ token: string }>();
  const token = isInviteToken(params.token) ? params.token : null;
  const info = useInviteLinkInfo(session ? token : null);
  const join = useJoinWithLink();

  // Signed out: keep the token so they return here after creating an account.
  // Once they are signed in and looking at it, there is nothing left to remember.
  useEffect(() => {
    if (!token) return;
    if (session) void takeRememberedInviteToken();
    else void rememberInviteToken(token);
  }, [session, token]);

  const goHome = () => router.replace('/');
  const openGroup = (id: string) => router.replace({ pathname: '/groups/[id]', params: { id } });

  if (!token) {
    return (
      <Screen safeTop>
        <EmptyState
          emoji="🔗"
          title="This link doesn’t look right"
          body="Ask whoever sent it to share the invite link again."
          action={<Button label="Open HATI" onPress={goHome} />}
        />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen
        safeTop
        footer={
          <>
            <Button label="Create an account" onPress={() => router.push('/auth/signup')} />
            <Button
              label="I already have an account"
              variant="ghost"
              onPress={() => router.push('/auth/login')}
            />
          </>
        }>
        <View style={styles.heading}>
          <Text variant="hero" accessibilityRole="header">
            You’re invited 🙌
          </Text>
          <Text color={colors.inkSoft}>
            Someone wants to split expenses with you on HATI. Create a free account or log in, and
            you’ll come straight back to this invite.
          </Text>
        </View>
      </Screen>
    );
  }

  if (info.isPending) {
    return (
      <Screen safeTop>
        <LoadingState label="Checking the invite…" />
      </Screen>
    );
  }

  if (info.isError) {
    return (
      <Screen safeTop>
        <ErrorState
          message={toMessage(info.error)}
          onRetry={() => info.refetch()}
          retrying={info.isFetching}
        />
      </Screen>
    );
  }

  if (!info.data) {
    return (
      <Screen safeTop>
        <EmptyState
          emoji="⌛"
          title="This invite has expired"
          body="Invite links stop working after a week, or when the group replaces them. Ask for a new one."
          action={<Button label="Open HATI" onPress={goHome} />}
        />
      </Screen>
    );
  }

  const { groupId, groupName, invitedByName, memberCount, alreadyMember } = info.data;
  const size = memberCount === 1 ? '1 member' : `${memberCount} members`;

  return (
    <Screen
      safeTop
      footer={
        alreadyMember ? (
          <Button label="Open group" onPress={() => openGroup(groupId)} />
        ) : (
          <>
            <FormError message={join.isError ? toMessage(join.error) : null} />
            <Button
              label="Join group"
              loading={join.isPending}
              onPress={() => join.mutate(token, { onSuccess: openGroup })}
            />
            <Button label="Not now" variant="ghost" disabled={join.isPending} onPress={goHome} />
          </>
        )
      }>
      <View style={styles.heading}>
        <Text variant="label" color={colors.inkSoft}>
          {alreadyMember
            ? 'You’re already in this group'
            : `${invitedByName ?? 'Someone'} invited you to join`}
        </Text>
        <Text variant="hero" accessibilityRole="header">
          {groupEmoji(groupName)} {groupName}
        </Text>
      </View>
      <Card>
        <Text variant="bodyBold">{size}</Text>
        <Text variant="small" color={colors.inkSoft}>
          {alreadyMember
            ? 'Nothing to do here. Open the group to see who owes who.'
            : 'Once you join, members can include you when they split an expense, and you’ll see everything recorded in the group.'}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
});
