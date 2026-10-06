import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography } from '@/constants/theme';

type Variant = keyof typeof typography;

export type TextProps = RNTextProps & {
  variant?: Variant;
  color?: string;
  center?: boolean;
};

export function Text({ variant = 'body', color = colors.ink, center, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[typography[variant], { color }, center && { textAlign: 'center' }, style]}
    />
  );
}
