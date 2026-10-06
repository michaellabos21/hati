import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/ui/Section';
import { FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { groupEmoji } from '@/features/groups/emoji';
import {
  useAcceptInvite,
  useDeclineInvite,
  useMyInvites,
  type MyInvite,
} from '@/features/invites/api';
import { toMessage } from '@/lib/errors';

function InviteCard({ invite }: { invite: MyInvite }) {
  const router = useRouter();
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const [error, setError] = useState<string | null>(null);
  const busy = accept.isPending || decline.isPending;
  const who = invite.invitedByName ?? 'Someone';
  const size = invite.memberCount === 1 ? '1 member' : `${invite.memberCount} members`;

  return (
    <Card>
      <View accessible accessibilityLabel={`${who} invited you to ${invite.groupName}, ${size}`}>
        <Text variant="small" color={colors.inkSoft}>
          {who} invited you to
        </Text>
        <Text variant="heading" numberOfLines={2}>
          {groupEmoji(invite.groupName)} {invite.groupName}
        </Text>
        <Text variant="small" color={colors.inkSoft}>
          {size}. You only join if you accept.
        </Text>
      </View>
      <FormError message={error} />
      <View style={styles.actions}>
        <Button
          label="Decline"
          variant="secondary"
          style={styles.action}
          disabled={busy}
          loading={decline.isPending}
          onPress={() => {
            setError(null);
            decline.mutate(invite.id, { onError: (caught) => setError(toMessage(caught)) });
          }}
        />
        <Button
          label="Join group"
          style={styles.action}
          disabled={busy}
          loading={accept.isPending}
          onPress={() => {
            setError(null);
            accept.mutate(invite.id, {
              onSuccess: (groupId) =>
                router.push({ pathname: '/groups/[id]', params: { id: groupId } }),
              onError: (caught) => setError(toMessage(caught)),
            });
          }}
        />
      </View>
    </Card>
  );
}

/**
 * Invites waiting for the signed-in user. Renders nothing when there are none, or if they
 * could not be loaded (the rest of Home still works, and pull-to-refresh retries).
 */
export function InviteCards() {
  const invites = useMyInvites();
  if (!invites.data || invites.data.length === 0) return null;

  return (
    <Section title={invites.data.length === 1 ? 'You have an invite' : 'You have invites'}>
      <View style={styles.list}>
        {invites.data.map((invite) => (
          <InviteCard key={invite.id} invite={invite} />
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  action: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
});
