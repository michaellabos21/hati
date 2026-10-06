import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type ViewStyle } from 'react-native';

type FadeInProps = {
  children: ReactNode;
  /** Position in a staggered sequence; each step starts 70ms after the last. */
  order?: number;
  style?: ViewStyle;
};

/** Rises and fades in once on mount. Skipped when the user has Reduce Motion on. */
export function FadeIn({ children, order = 0, style }: FadeInProps) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          progress.setValue(1);
          return;
        }
        Animated.timing(progress, {
          toValue: 1,
          duration: 360,
          delay: order * 70,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      });
    return () => {
      cancelled = true;
    };
  }, [order, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}
