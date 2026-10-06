import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card, Perforation } from '@/components/ui/Card';
import { FadeIn } from '@/components/ui/FadeIn';
import { Screen } from '@/components/ui/Screen';
import { FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { colors, radii, shadows, spacing } from '@/constants/theme';
import {
  PREMIUM_FEATURES,
  PREMIUM_PRICE,
  usePremiumInterest,
  useRegisterPremiumInterest,
} from '@/features/premium/api';
import { formatPeso } from '@/lib/currency';
import { toMessage } from '@/lib/errors';

export default function PremiumScreen() {
  const interest = usePremiumInterest();
  const register = useRegisterPremiumInterest();
  const onList = interest.data === true;

  return (
    <Screen
      footer={
        <>
          <FormError message={register.isError ? toMessage(register.error) : null} />
          {onList ? (
            <View style={styles.onList} accessibilityRole="alert">
              <Text variant="bodyBold" color={colors.owed} center>
                You’re on the list ✓
              </Text>
              <Text variant="small" color={colors.inkSoft} center>
                We’ll let you know here when Premium is ready. You have not been charged.
              </Text>
            </View>
          ) : (
            <>
              <Button
                label="Try Premium"
                onPress={() => register.mutate()}
                loading={register.isPending}
                disabled={interest.isPending}
                accessibilityHint="Tells us you are interested. You will not be charged."
              />
              <Text variant="small" color={colors.inkSoft} center>
                Premium isn’t available yet. Tapping this only tells us you want it; nothing is
                charged.
              </Text>
            </>
          )}
        </>
      }>
      <FadeIn style={styles.heading}>
        <View style={styles.badge}>
          <Text variant="smallBold">Coming soon</Text>
        </View>
        <Text variant="hero" accessibilityRole="header">
          Premium
        </Text>
        <Text color={colors.inkSoft}>
          Everything in HATI stays free. Premium is for groups that want more.
        </Text>
      </FadeIn>

      <FadeIn order={1}>
        <View style={styles.shadow}>
          <Card tone="ink" style={styles.card}>
            {PREMIUM_FEATURES.map((feature) => (
              <View
                key={feature.title}
                style={styles.feature}
                accessible
                accessibilityLabel={`${feature.title}. ${feature.detail}`}>
                <Text style={styles.check} color={colors.brand}>
                  ✓
                </Text>
                <View style={styles.featureText}>
                  <Text variant="bodyBold" color={colors.paper}>
                    {feature.title}
                  </Text>
                  <Text variant="small" color={colors.onInkMuted}>
                    {feature.detail}
                  </Text>
                </View>
              </View>
            ))}

            <Perforation lineColor="#243027" />

            <View
              style={styles.price}
              accessible
              accessibilityLabel={`Planned price ${formatPeso(PREMIUM_PRICE, { compact: true })} per month`}>
              <Text variant="amountLarge" color={colors.brand} style={styles.priceAmount}>
                {formatPeso(PREMIUM_PRICE, { compact: true })}
              </Text>
              <Text color={colors.onInkMuted}>/month, planned</Text>
            </View>
          </Card>
        </View>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  badge: {
    backgroundColor: colors.brandSoft,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  shadow: {
    ...shadows.raised,
    borderRadius: radii.lg,
  },
  card: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  feature: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  check: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    width: 20,
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  price: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  priceAmount: {
    fontSize: 40,
    lineHeight: 46,
  },
  onList: {
    gap: spacing.xs,
    backgroundColor: colors.owedSoft,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
});
