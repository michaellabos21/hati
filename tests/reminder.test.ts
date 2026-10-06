import { buildReminder } from '@/features/settlements/reminder';

describe('buildReminder', () => {
  const base = { debtorName: 'Juan Dela Cruz', amount: 40000, reason: 'Boracay 2026' };

  it('writes a friendly Paki-GCash message using the first name', () => {
    expect(buildReminder(base)).toBe(
      'Uy Juan! Paki-GCash naman ng ₱400 para sa Boracay 2026 😭\nSalamat!',
    );
  });

  it('includes wallet numbers when the creditor has them', () => {
    const message = buildReminder({
      ...base,
      gcashNumber: '09171234567',
      mayaNumber: '09181234567',
    });
    expect(message).toContain('GCash: 09171234567');
    expect(message).toContain('Maya: 09181234567');
  });

  it('asks for Maya when that is the only wallet', () => {
    const message = buildReminder({ ...base, mayaNumber: '09181234567' });
    expect(message).toContain('Paki-Maya');
    expect(message).not.toContain('GCash');
  });

  it('keeps centavos when the amount has them', () => {
    expect(buildReminder({ ...base, amount: 40050 })).toContain('₱400.50');
  });
});
