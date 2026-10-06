import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { GroupGate } from '@/components/GroupGate';
import { Button } from '@/components/ui/Button';
import { Card, Perforation } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/constants/theme';
import { useProfile } from '@/features/auth/api';
import { findMember, type GroupView } from '@/features/ledger/selectors';
import { buildReminder } from '@/features/settlements/reminder';

export default function RemindScreen() {
  return <GroupGate>{(view, userId) => <Remind view={view} userId={userId} />}</GroupGate>;
}

function Remind({ view, userId }: { view: GroupView; userId: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ to?: string; amount?: string }>();
  const [status, setStatus] = useState<string | null>(null);
  const { group, transfers } = view;

  // Trust the ledger, not the link: only remind about a debt that still exists.
  const transfer = transfers.find((t) => t.from === params.to && t.to === userId);
  const debtor = params.to ? findMember(group, params.to) : undefined;
  // Wallet numbers are private, so they come from the user's own profile, not the group.
  const me = useProfile(userId).data;

  if (!transfer || !debtor) {
    return (
      <EmptyState
        emoji="🤝"
        title="Nothing to remind"
        body="This debt has already been settled."
        action={<Button label="Back to balances" onPress={() => router.back()} />}
      />
    );
  }

  const message = buildReminder({
    debtorName: debtor.displayName,
    amount: transfer.amount,
    reason: group.name,
    gcashNumber: me?.gcashNumber,
    mayaNumber: me?.mayaNumber,
  });
  const hasWallet = Boolean(me?.gcashNumber || me?.mayaNumber);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(message);
      setStatus('Copied. Paste it in your chat.');
    } catch {
      setStatus('Could not copy. Press and hold the message to select it instead.');
    }
  };

  const share = async () => {
    setStatus(null);
    try {
      await Share.share({ message });
    } catch {
      // No share sheet (for example on desktop web): copying is the next best thing.
      await copy();
    }
  };

  return (
    <>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          Singilin si {debtor.displayName.trim().split(/\s+/)[0]}
        </Text>
        <Text color={colors.inkSoft}>
          Send this through Messenger, Viber or wherever your barkada chats. HATI never sends
          messages for you.
        </Text>
      </View>

      <Card>
        <Text variant="label" color={colors.inkSoft}>
          Your message
        </Text>
        <Perforation />
        <Text selectable style={styles.message}>
          {message}
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button label="Share" onPress={share} />
        <Button label="Copy message" variant="secondary" onPress={copy} />
        {status ? (
          <Text variant="smallBold" color={colors.owed} center accessibilityLiveRegion="polite">
            {status}
          </Text>
        ) : null}
      </View>

      {hasWallet ? null : (
        <View style={styles.tip}>
          <Text variant="small" color={colors.inkSoft}>
            Tip: add your GCash or Maya number in Profile and it will be included here.
          </Text>
          <Button
            label="Open Profile"
            variant="ghost"
            compact
            onPress={() => router.dismissTo('/profile')}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xs,
  },
  message: {
    fontSize: 18,
    lineHeight: 26,
  },
  actions: {
    gap: spacing.md,
  },
  tip: {
    alignItems: 'center',
    gap: spacing.xs,
  },
});
