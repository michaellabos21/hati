import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GroupGate } from '@/components/GroupGate';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { EmptyState, FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/constants/theme';
import { MAX_AMOUNT } from '@/features/expenses/splits';
import type { GroupView } from '@/features/ledger/selectors';
import { useRecordSettlement } from '@/features/settlements/api';
import { centavosToNumeric, formatPeso, parseAmountToCentavos } from '@/lib/currency';
import { toMessage } from '@/lib/errors';

type Mode = 'pay' | 'receive';

export default function SettleScreen() {
  return <GroupGate bare>{(view, userId) => <Settle view={view} userId={userId} />}</GroupGate>;
}

function Settle({ view, userId }: { view: GroupView; userId: string }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; other?: string; amount?: string }>();
  const { group, transfers } = view;
  const others = group.members.filter((member) => member.id !== userId);
  const record = useRecordSettlement(group.id);

  const presetAmount = Number(params.amount);
  const [mode, setMode] = useState<Mode>(params.mode === 'receive' ? 'receive' : 'pay');
  const [other, setOther] = useState<string | null>(
    others.some((member) => member.id === params.other) ? (params.other ?? null) : null,
  );
  const [amountText, setAmountText] = useState(
    Number.isInteger(presetAmount) && presetAmount > 0 ? centavosToNumeric(presetAmount) : '',
  );
  const [submitted, setSubmitted] = useState(false);

  if (others.length === 0) {
    return (
      <Screen>
        <EmptyState
          emoji="👋"
          title="No one to settle with"
          body="Add someone to the group first."
        />
      </Screen>
    );
  }

  const amount = parseAmountToCentavos(amountText);
  const otherName = others.find((member) => member.id === other)?.displayName;
  const from = mode === 'pay' ? userId : other;
  const to = mode === 'pay' ? other : userId;
  // What HATI currently suggests between these two people, in this direction.
  const suggested = transfers.find((t) => t.from === from && t.to === to)?.amount ?? 0;

  const amountError =
    amount === null
      ? 'Enter a valid amount.'
      : amount <= 0
        ? 'Amount must be more than ₱0.'
        : amount > MAX_AMOUNT
          ? 'That amount is too large.'
          : undefined;
  const otherError = other === null ? 'Choose who.' : undefined;

  const submit = () => {
    setSubmitted(true);
    if (amountError || !from || !to || amount === null) return;
    record.mutate({ from, to, amount }, { onSuccess: () => router.back() });
  };

  const summary =
    otherName && amount && amount > 0
      ? mode === 'pay'
        ? `You paid ${otherName} ${formatPeso(amount)}`
        : `${otherName} paid you ${formatPeso(amount)}`
      : null;

  return (
    <Screen
      footer={
        <>
          {summary ? (
            <Text variant="smallBold" center accessibilityLiveRegion="polite">
              {summary}
            </Text>
          ) : null}
          <FormError message={record.isError ? toMessage(record.error) : null} />
          <Button label="Save payment" onPress={submit} loading={record.isPending} />
        </>
      }>
      <View style={styles.heading}>
        <Text variant="title" accessibilityRole="header">
          Bayad na?
        </Text>
        <Text color={colors.inkSoft}>
          Record money that already changed hands, by GCash, Maya or cash. HATI does not move money.
        </Text>
      </View>

      <Section title="What happened">
        <View
          style={styles.chips}
          accessibilityRole="radiogroup"
          accessibilityLabel="What happened">
          <Chip label="I paid someone" selected={mode === 'pay'} onPress={() => setMode('pay')} />
          <Chip
            label="Someone paid me"
            selected={mode === 'receive'}
            onPress={() => setMode('receive')}
          />
        </View>
      </Section>

      <Section title={mode === 'pay' ? 'Who did you pay?' : 'Who paid you?'}>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Who">
          {others.map((member) => (
            <Chip
              key={member.id}
              label={member.displayName}
              selected={other === member.id}
              onPress={() => setOther(member.id)}
              leading={<Avatar id={member.id} name={member.displayName} size={26} />}
            />
          ))}
        </View>
        {submitted && otherError ? (
          <Text variant="small" color={colors.owe}>
            {otherError}
          </Text>
        ) : null}
      </Section>

      <View style={styles.amount}>
        <Field
          label="Amount"
          value={amountText}
          onChangeText={setAmountText}
          error={submitted ? amountError : undefined}
          prefix="₱"
          placeholder="0.00"
          keyboardType="decimal-pad"
          maxLength={13}
          numeric
        />
        {suggested > 0 && amount !== suggested ? (
          <Button
            label={`Use full amount · ${formatPeso(suggested, { compact: true })}`}
            variant="secondary"
            compact
            onPress={() => setAmountText(centavosToNumeric(suggested))}
          />
        ) : null}
        {other !== null && amount !== null && amount > suggested ? (
          <View style={styles.note}>
            <Text variant="small">
              {suggested > 0
                ? `That is more than the ${formatPeso(suggested, { compact: true })} owed. The extra will show up as a balance the other way.`
                : `HATI does not show a debt in this direction. Saving this will create a balance the other way.`}
            </Text>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  amount: {
    gap: spacing.md,
    alignItems: 'stretch',
  },
  note: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
});
