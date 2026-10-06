import { Platform, type FontVariant } from 'react-native';

// HATI design tokens. One styling system: StyleSheet + these tokens.
//
// Colours are the Mulave Studios brand: logo green #01EC0B on near-black #060906, with the
// brand's deep forest green and soft off-white. The other tokens are tints derived from those.
//
// Direction: clean, modern fintech with a social feel. White cards on a quiet background, soft
// shadows instead of outlines, people (avatars) and plain sentences up front. Brand green is
// reserved for the thing you tap next and for money coming to you; red means money you owe.

export const colors = {
  paper: '#F4F7F4',
  paperDeep: '#E7EDE8',
  surface: '#FFFFFF',
  ink: '#060906',
  inkSoft: '#445046',
  // Lightest text that still passes 4.5:1 on paper: timestamps, placeholders.
  inkFaint: '#5F6E62',
  // Muted text on the ink-coloured balance card (the brand's green-grey).
  onInkMuted: '#A3B3A5',
  line: '#DDE5DE',
  // Logo green: primary buttons, the active tab, highlights on the dark card.
  brand: '#01EC0B',
  brandSoft: '#D6FBD8',
  // Brand deep forest green, for tinted panels.
  forest: '#0B3D12',
  // Bayad: money coming to you. A darker brand green that is readable as text on white.
  owed: '#0A7512',
  owedSoft: '#DDF7DF',
  // Utang: money you owe.
  owe: '#C0341D',
  oweSoft: '#FDE7E2',
  white: '#FFFFFF',
} as const;

/** Background colours for initials avatars, picked by hashing the user id. */
export const avatarColors = [
  '#9FF5A3',
  '#FFD66B',
  '#A9DBF8',
  '#FFB3C7',
  '#D3C6F8',
  '#FFC59B',
] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
  body: 'InstrumentSans_400Regular',
  bodyMedium: 'InstrumentSans_500Medium',
  bodyBold: 'InstrumentSans_600SemiBold',
} as const;

/** Tabular figures, so columns of pesos line up. Spread into any style that shows amounts. */
export const tabular: { fontVariant: FontVariant[] } = { fontVariant: ['tabular-nums'] };

export const typography = {
  hero: { fontFamily: fonts.display, fontSize: 44, lineHeight: 50, letterSpacing: -1.2 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19 },
  smallBold: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
  amount: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, ...tabular },
  amountLarge: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    ...tabular,
  },
} as const;

/** Hairline border for cards, inputs and secondary buttons. */
export const outline = { borderWidth: 1, borderColor: colors.line } as const;

export const shadows = {
  /** Barely-there lift for cards and lists. */
  card: { boxShadow: '0px 1px 2px rgba(6, 9, 6, 0.05), 0px 1px 3px rgba(6, 9, 6, 0.06)' },
  /** For the one hero element on a screen. */
  raised: { boxShadow: '0px 12px 24px rgba(6, 9, 6, 0.14)' },
  /** A brand-green glow under the primary button. */
  primary: { boxShadow: '0px 6px 14px rgba(1, 236, 11, 0.28)' },
} as const;

/**
 * Text inputs draw their own focus state (the box border), so the browser's focus ring is
 * turned off on web. `outlineStyle: 'none'` is web-only and not in React Native's types.
 */
export const noFocusRing: object = Platform.OS === 'web' ? { outlineStyle: 'none' } : {};

/** Minimum comfortable touch target. */
export const TOUCH_TARGET = 48;
