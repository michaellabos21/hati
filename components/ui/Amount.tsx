import { Text, type TextProps } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { formatPeso } from '@/lib/currency';

type AmountProps = Omit<TextProps, 'children'> & {
  centavos: number;
  /** Colour by direction: green when positive (owed to you), red when negative (you owe). */
  tone?: 'neutral' | 'balance';
  signed?: boolean;
  compact?: boolean;
  large?: boolean;
};

export function Amount({
  centavos,
  tone = 'neutral',
  signed,
  compact = true,
  large,
  ...rest
}: AmountProps) {
  const color =
    tone === 'balance'
      ? centavos > 0
        ? colors.owed
        : centavos < 0
          ? colors.owe
          : colors.inkSoft
      : colors.ink;
  return (
    <Text variant={large ? 'amountLarge' : 'amount'} color={color} numberOfLines={1} {...rest}>
      {formatPeso(centavos, { compact, signed })}
    </Text>
  );
}
