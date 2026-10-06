import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Amount } from '@/components/ui/Amount';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { EmptyState, FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  colors,
  fonts,
  noFocusRing,
  outline,
  radii,
  shadows,
  spacing,
  tabular,
} from '@/constants/theme';
import type { NewExpense } from '@/features/expenses/api';
import { splitEqually, sumSplits, validateExpense, type Split } from '@/features/expenses/splits';
import { meFirst } from '@/features/ledger/selectors';
import { centavosToNumeric, formatPeso, parseAmountToCentavos } from '@/lib/currency';
import type { Expense, Group, SplitMethod } from '@/types/domain';

/** A blank exact-amount box counts as ₱0; anything unparseable is NaN and fails validation. */
function parseShare(text: string | undefined): number {
  if (!text || text.trim() === '') return 0;
  return parseAmountToCentavos(text) ?? Number.NaN;
}

type ExpenseFormProps = {
  group: Group;
  userId: string;
  /** The expense being edited. Leave out when adding a new one. */
  initial?: Expense;
  submitLabel: string;
  onSubmit: (expense: NewExpense) => void;
  pending: boolean;
  /** Error from the last save attempt, already in plain language. */
  error: string | null;
};

/** The add/edit expense form. It validates; the screen that uses it decides how to save. */
export function ExpenseForm({
  group,
  userId,
  initial,
  submitLabel,
  onSubmit,
  pending,
  error,
}: ExpenseFormProps) {
  const router = useRouter();
  const members = meFirst(group.members, userId);
  const memberIds = new Set(members.map((member) => member.id));
  // People in the original split who have since left cannot be kept: the database only
  // accepts current members.
  const departed = initial
    ? initial.splits.filter((split) => !memberIds.has(split.userId)).length
    : 0;

  const [amountText, setAmountText] = useState(initial ? centavosToNumeric(initial.amount) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [paidBy, setPaidBy] = useState(
    initial && memberIds.has(initial.paidBy) ? initial.paidBy : userId,
  );
  const [method, setMethod] = useState<SplitMethod>(initial?.splitMethod ?? 'equal');
  const [selected, setSelected] = useState(
    () =>
      new Set(
        initial
          ? initial.splits.map((split) => split.userId).filter((id) => memberIds.has(id))
          : members.map((member) => member.id),
      ),
  );
  const [exactText, setExactText] = useState<Record<string, string>>(() =>
    initial
      ? Object.fromEntries(
          initial.splits.map((split) => [split.userId, centavosToNumeric(split.amount)]),
        )
      : {},
  );
  const [submitted, setSubmitted] = useState(false);

  const total = parseAmountToCentavos(amountText);
  const participantIds = members.filter((m) => selected.has(m.id)).map((m) => m.id);
  const splits: Split[] =
    method === 'equal'
      ? splitEqually(total ?? 0, participantIds)
      : participantIds.map((id) => ({ userId: id, amount: parseShare(exactText[id]) }));
  const shareOf = new Map(splits.map((split) => [split.userId, split.amount]));

  const errors = validateExpense({
    description,
    amount: amountText.trim() === '' ? null : total,
    paidBy,
    memberIds: members.map((member) => member.id),
    splits,
  });
  const valid = Object.keys(errors).length === 0;
  const shown = submitted ? errors : {};

  const assigned = sumSplits(splits.filter((split) => Number.isInteger(split.amount)));
  const remaining = (total ?? 0) - assigned;

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chooseMethod = (next: SplitMethod) => {
    // Start exact amounts from the equal split, so there is something sensible to adjust.
    if (next === 'exact' && Object.keys(exactText).length === 0 && total) {
      setExactText(
        Object.fromEntries(
          splitEqually(total, participantIds).map((s) => [s.userId, centavosToNumeric(s.amount)]),
        ),
      );
    }
    setMethod(next);
  };

  const submit = () => {
    setSubmitted(true);
    if (!valid || total === null) return;
    onSubmit({ description, amount: total, paidBy, splitMethod: method, splits });
  };

  if (members.length < 2) {
    return (
      <Screen>
        <EmptyState
          emoji="👋"
          title="Invite someone first"
          body="You need at least one other member to split with. People you have invited count once they accept."
          action={
            <Button
              label="Invite someone"
              onPress={() =>
                router.replace({ pathname: '/groups/[id]/add-member', params: { id: group.id } })
              }
            />
          }
        />
      </Screen>
    );
  }

  const totalLabel =
    total === null || total === 0
      ? 'Enter an amount'
      : remaining === 0
        ? 'Adds up ✓'
        : remaining > 0
          ? `${formatPeso(remaining, { compact: true })} left to assign`
          : `${formatPeso(-remaining, { compact: true })} over`;

  return (
    <Screen
      footer={
        <>
          <View style={styles.totalRow} accessible accessibilityLiveRegion="polite">
            <Text
              variant="smallBold"
              color={total && remaining === 0 ? colors.owed : total ? colors.owe : colors.inkSoft}>
              {totalLabel}
            </Text>
            <Text variant="amount" color={colors.inkSoft}>
              {formatPeso(assigned, { compact: true })} /{' '}
              {formatPeso(total ?? 0, { compact: true })}
            </Text>
          </View>
          <FormError message={error} />
          <Button label={submitLabel} onPress={submit} loading={pending} />
        </>
      }>
      {departed > 0 ? (
        <View style={styles.note} accessibilityRole="alert">
          <Text variant="small">
            {departed === 1 ? 'Someone' : `${departed} people`} in this split left the group, so
            their share has to be reassigned before you can save.
          </Text>
        </View>
      ) : null}

      <View style={styles.amountBlock}>
        <Text variant="label" color={colors.inkSoft}>
          Amount
        </Text>
        <View style={[styles.amountBox, !!shown.amount && styles.amountInvalid]}>
          <Text style={styles.peso}>₱</Text>
          <TextInput
            accessibilityLabel="Amount in pesos"
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
            placeholderTextColor={colors.inkFaint}
            selectionColor={colors.ink}
            keyboardType="decimal-pad"
            autoFocus={!initial}
            maxLength={13}
            style={styles.amountInput}
          />
        </View>
        {shown.amount ? (
          <Text variant="small" color={colors.owe}>
            {shown.amount}
          </Text>
        ) : null}
      </View>

      <Field
        label="What was it for?"
        value={description}
        onChangeText={setDescription}
        error={shown.description}
        placeholder="Dinner, Grab, hotel…"
        maxLength={120}
        autoCapitalize="sentences"
      />

      <Section title="Paid by">
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Paid by">
          {members.map((member) => (
            <Chip
              key={member.id}
              label={member.id === userId ? 'You' : member.displayName}
              selected={paidBy === member.id}
              onPress={() => setPaidBy(member.id)}
              leading={<Avatar id={member.id} name={member.displayName} size={26} />}
            />
          ))}
        </View>
        {shown.paidBy ? (
          <Text variant="small" color={colors.owe}>
            {shown.paidBy}
          </Text>
        ) : null}
      </Section>

      <Section title="Split">
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Split method">
          <Chip
            label="Equally"
            selected={method === 'equal'}
            onPress={() => chooseMethod('equal')}
          />
          <Chip
            label="Exact amounts"
            selected={method === 'exact'}
            onPress={() => chooseMethod('exact')}
          />
        </View>

        <View style={styles.people}>
          {members.map((member, index) => {
            const included = selected.has(member.id);
            const name = member.id === userId ? 'You' : member.displayName;
            return (
              <View key={member.id} style={[styles.person, index > 0 && styles.personBorder]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Include ${name}`}
                  accessibilityState={{ checked: included }}
                  onPress={() => toggle(member.id)}
                  style={styles.personToggle}>
                  <Ionicons
                    name={included ? 'checkbox' : 'square-outline'}
                    size={26}
                    color={included ? colors.ink : colors.inkFaint}
                  />
                  <Text
                    variant="bodyBold"
                    color={included ? colors.ink : colors.inkFaint}
                    numberOfLines={1}
                    style={styles.personName}>
                    {name}
                  </Text>
                </Pressable>
                {!included ? null : method === 'equal' ? (
                  <Amount centavos={shareOf.get(member.id) ?? 0} compact={false} />
                ) : (
                  <View style={styles.shareBox}>
                    <Text variant="amount" color={colors.inkSoft}>
                      ₱
                    </Text>
                    <TextInput
                      accessibilityLabel={
                        member.id === userId ? 'Your share in pesos' : `${name}'s share in pesos`
                      }
                      value={exactText[member.id] ?? ''}
                      onChangeText={(text) =>
                        setExactText((current) => ({ ...current, [member.id]: text }))
                      }
                      placeholder="0.00"
                      placeholderTextColor={colors.inkFaint}
                      selectionColor={colors.ink}
                      keyboardType="decimal-pad"
                      maxLength={13}
                      style={styles.shareInput}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
        {shown.splits ? (
          <Text variant="small" color={colors.owe}>
            {shown.splits}
          </Text>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  amountBlock: {
    gap: spacing.sm,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    paddingBottom: spacing.xs,
  },
  amountInvalid: {
    borderBottomColor: colors.owe,
  },
  peso: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 48,
    color: colors.inkSoft,
  },
  amountInput: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 44,
    letterSpacing: -1,
    ...tabular,
    color: colors.ink,
    paddingVertical: 0,
    minHeight: 60,
    minWidth: 0,
    ...noFocusRing,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  people: {
    ...outline,
    ...shadows.card,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.lg,
    minHeight: 60,
  },
  personBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  personToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    alignSelf: 'stretch',
  },
  personName: {
    flexShrink: 1,
  },
  shareBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    ...outline,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    width: 130,
    minHeight: 44,
    backgroundColor: colors.paper,
  },
  shareInput: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    ...tabular,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'right',
    paddingVertical: 0,
    minWidth: 0,
    ...noFocusRing,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
