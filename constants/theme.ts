// Design tokens for HATI. Single styling system: StyleSheet + these tokens.

export const colors = {
  primary: '#0E9F6E',
  primaryDark: '#057A55',
  primarySoft: '#DEF7EC',
  accent: '#F5B700',
  background: '#F8FAF9',
  surface: '#FFFFFF',
  border: '#E3E8E5',
  text: '#10201A',
  textMuted: '#5F6F68',
  positive: '#0E9F6E',
  negative: '#D64545',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;
