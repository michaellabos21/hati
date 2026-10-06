import { APP_NAME, APP_TAGLINE } from '@/constants/app';
import { colors, spacing } from '@/constants/theme';

describe('project foundation', () => {
  it('resolves the @/ path alias and exposes app constants', () => {
    expect(APP_NAME).toBe('HATI');
    expect(APP_TAGLINE).toHaveLength(3);
  });

  it('defines design tokens', () => {
    expect(colors.brand).toMatch(/^#[0-9A-F]{6}$/i);
    expect(spacing.md).toBeGreaterThan(spacing.sm);
  });
});
