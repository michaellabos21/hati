import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card, Perforation } from '@/components/ui/Card';
import { FadeIn } from '@/components/ui/FadeIn';
import { Screen } from '@/components/ui/Screen';
import { FormError } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { APP_NAME, APP_TAGLINE } from '@/constants/app';
import { colors, radii, shadows, spacing } from '@/constants/theme';
import { logIn } from '@/features/auth/api';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo/sampleData';
import { toMessage } from '@/lib/errors';
import { DEMO_MODE } from '@/lib/supabase';

const SHARES = ['Michael', 'Juan', 'Ana', 'Bea'];

/** A little receipt that shows the whole idea of the app at a glance. */
function SampleReceipt() {
  return (
    <View style={styles.receiptShadow}>
      <Card style={styles.receipt}>
        <View style={styles.receiptRow}>
          <Text variant="label" color={colors.inkSoft}>
            Dinner · Barkada
          </Text>
          <Text variant="amount">₱2,400</Text>
        </View>
        <Perforation />
        {SHARES.map((name) => (
          <View key={name} style={styles.receiptRow}>
            <Text variant="small">{name}</Text>
            <Text variant="amount" color={colors.inkSoft}>
              ₱600
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [openingDemo, setOpeningDemo] = useState(false);

  // Signs in as the sample user; the auth guard then opens the app.
  const openDemo = async () => {
    setDemoError(null);
    setOpeningDemo(true);
    try {
      await logIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    } catch (caught) {
      setDemoError(toMessage(caught));
      setOpeningDemo(false);
    }
  };

  return (
    <Screen
      safeTop
      footer={
        <>
          {DEMO_MODE ? (
            <>
              <FormError message={demoError} />
              <Button label="Explore with sample data" onPress={openDemo} loading={openingDemo} />
            </>
          ) : null}
          {DEMO_MODE ? null : step === 0 ? (
            <Button label="Get started" onPress={() => setStep(1)} />
          ) : (
            <Button label="Continue" onPress={() => router.push('/auth/signup')} />
          )}
          {DEMO_MODE ? (
            <Button
              label="Create a demo account"
              variant="secondary"
              onPress={() => router.push('/auth/signup')}
            />
          ) : null}
          <Button
            label="I already have an account"
            variant="ghost"
            onPress={() => router.push('/auth/login')}
          />
        </>
      }>
      {step === 0 ? (
        <View style={styles.block} key="intro">
          <FadeIn>
            <Text variant="hero" accessibilityRole="header">
              {APP_NAME} 🇵🇭
            </Text>
          </FadeIn>
          <FadeIn order={1} style={styles.tagline}>
            {APP_TAGLINE.map((line, index) => (
              <Text
                key={line}
                variant="title"
                color={index === APP_TAGLINE.length - 1 ? colors.ink : colors.inkSoft}>
                {line}
              </Text>
            ))}
          </FadeIn>
          <FadeIn order={3} style={styles.receiptWrap}>
            <SampleReceipt />
          </FadeIn>
        </View>
      ) : (
        <View style={styles.block} key="pitch">
          <FadeIn style={styles.pitchHeader}>
            <Button label="Back" variant="ghost" compact onPress={() => setStep(0)} />
            <Text variant="label" color={colors.inkSoft}>
              Paano gumagana
            </Text>
          </FadeIn>
          {[
            ['🍜', 'Split bills with your barkada.', 'Dinner, trips, rent, school projects.'],
            ['🧾', 'Track every utang.', 'See who paid, who owes, and how much.'],
            ['💸', 'Settle without the mental math.', 'HATI works out who pays whom.'],
          ].map(([emoji, title, body], index) => (
            <FadeIn key={title} order={index + 1} style={styles.point}>
              <Text style={styles.pointEmoji}>{emoji}</Text>
              <View style={styles.pointText}>
                <Text variant="heading">{title}</Text>
                <Text color={colors.inkSoft}>{body}</Text>
              </View>
            </FadeIn>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.xl,
    paddingTop: spacing.xxl,
  },
  pitchHeader: {
    alignItems: 'flex-start',
    gap: spacing.md,
    marginLeft: -spacing.lg,
  },
  tagline: {
    gap: 2,
  },
  receiptWrap: {
    paddingTop: spacing.lg,
    paddingRight: spacing.xxxl,
  },
  receiptShadow: {
    ...shadows.raised,
    borderRadius: radii.lg,
    transform: [{ rotate: '-2deg' }],
  },
  receipt: {
    gap: spacing.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  point: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  pointEmoji: {
    fontSize: 32,
    lineHeight: 40,
  },
  pointText: {
    flex: 1,
    gap: spacing.xs,
  },
});
