import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { avatarColors, fonts } from '@/constants/theme';

type AvatarProps = {
  id: string;
  name: string;
  size?: number;
};

function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) % 9973;
  }
  return total;
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({ id, name, size = 40 }: AvatarProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColors[hash(id) % avatarColors.length],
        },
      ]}>
      <Text
        style={{ fontFamily: fonts.displayMedium, fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
