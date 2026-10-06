import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Section } from '@/components/ui/Section';
import { FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import {
  buildInviteMessage,
  buildInviteUrl,
  daysLeft,
  useCreateInviteLink,
  useInviteLink,
  useRemoveInviteLink,
  webOrigin,
} from '@/features/invites/links';
import { confirm } from '@/lib/confirm';
import { toMessage } from '@/lib/errors';

/** Lets a member create, share and switch off the group's invite link. */
export function InviteLinkSection({ groupId, groupName }: { groupId: string; groupName: string }) {
  const link = useInviteLink(groupId);
  const create = useCreateInviteLink(groupId);
  const remove = useRemoveInviteLink(groupId);
  const [status, setStatus] = useState<string | null>(null);

  const failure = create.isError ? create.error : remove.isError ? remove.error : null;
  const url = link.data ? buildInviteUrl(webOrigin(), link.data.token) : null;

  const copy = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setStatus('Link copied. Paste it in your group chat.');
    } catch {
      setStatus('Could not copy. Press and hold the link to select it instead.');
    }
  };

  const share = async (text: string) => {
    setStatus(null);
    try {
      await Share.share({ message: text });
    } catch {
      // No share sheet (for example on desktop web): copying is the next best thing.
      await copy(text);
    }
  };

  const turnOff = async () => {
    const yes = await confirm({
      title: 'Turn off this link?',
      message: 'Anyone who has it will no longer be able to join. You can make a new link later.',
      confirmLabel: 'Turn off',
      destructive: true,
    });
    if (yes) {
      setStatus(null);
      remove.mutate();
    }
  };

  return (
    <Section title="Or share a link">
      {url && link.data ? (
        <Card>
          <Text selectable variant="smallBold" numberOfLines={2}>
            {url}
          </Text>
          <Text variant="small" color={colors.inkSoft} style={styles.note}>
            Anyone with this link can join {groupName}. It works for{' '}
            {daysLeft(link.data.expiresAt) === 1
              ? '1 more day'
              : `${daysLeft(link.data.expiresAt)} more days`}
            .
          </Text>
          <View style={styles.actions}>
            <Button
              label="Share"
              style={styles.action}
              onPress={() => share(buildInviteMessage(groupName, url))}
            />
            <Button
              label="Copy"
              variant="secondary"
              style={styles.action}
              onPress={() => copy(url)}
            />
          </View>
          {status ? (
            <Text
              variant="smallBold"
              color={colors.owed}
              center
              style={styles.status}
              accessibilityLiveRegion="polite">
              {status}
            </Text>
          ) : null}
          <Button
            label="Turn off this link"
            variant="ghost"
            compact
            onPress={turnOff}
            loading={remove.isPending}
            style={styles.off}
          />
        </Card>
      ) : (
        <>
          <Text color={colors.inkSoft}>
            Easier for a whole barkada: one link for the group chat. People who open it choose
            whether to join, even if they don’t have HATI yet.
          </Text>
          <Button
            label="Create invite link"
            variant="secondary"
            onPress={() => {
              setStatus(null);
              create.mutate();
            }}
            loading={create.isPending}
            disabled={link.isPending}
          />
        </>
      )}
      <FormError message={failure ? toMessage(failure) : null} />
    </Section>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: spacing.xs,
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
  status: {
    marginTop: spacing.md,
  },
  off: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
});
