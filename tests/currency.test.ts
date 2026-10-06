import {
  centavosToNumeric,
  formatPeso,
  numericToCentavos,
  parseAmountToCentavos,
} from '@/lib/currency';

describe('parseAmountToCentavos', () => {
  it.each([
    ['600', 60000],
    ['600.5', 60050],
    ['600.50', 60050],
    ['1,250.50', 125050],
    ['₱ 2,400', 240000],
    ['0.01', 1],
    ['.5', 50],
    ['12.', 1200],
    ['0', 0],
    // Values that break naive float maths: 0.29 * 100 = 28.999999999999996
    ['0.29', 29],
    ['1.15', 115],
    ['4.35', 435],
    ['9999999.99', 999999999],
  ])('parses %s', (input, expected) => {
    expect(parseAmountToCentavos(input)).toBe(expected);
  });

  it.each(['', '.', 'abc', '-5', '1.234', '1.2.3', '1e3', '12345678901'])('rejects %j', (input) => {
    expect(parseAmountToCentavos(input)).toBeNull();
  });
});

describe('numericToCentavos', () => {
  it('converts database numerics exactly', () => {
    expect(numericToCentavos(2400)).toBe(240000);
    expect(numericToCentavos(1250.5)).toBe(125050);
    expect(numericToCentavos(0.29)).toBe(29);
    expect(numericToCentavos(1.15)).toBe(115);
    expect(numericToCentavos('1250.50')).toBe(125050);
    expect(numericToCentavos('-600.00')).toBe(-60000);
  });

  it('throws on garbage', () => {
    expect(() => numericToCentavos('abc')).toThrow();
  });
});

describe('centavosToNumeric', () => {
  it('round-trips with numericToCentavos', () => {
    for (const centavos of [0, 1, 29, 99, 100, 115, 125050, 240000, 999999999]) {
      const numeric = centavosToNumeric(centavos);
      expect(numeric).toMatch(/^\d+\.\d{2}$/);
      expect(numericToCentavos(numeric)).toBe(centavos);
    }
    expect(centavosToNumeric(-5)).toBe('-0.05');
  });
});

describe('formatPeso', () => {
  it('formats with peso sign, thousands separators and two decimals', () => {
    expect(formatPeso(125000)).toBe('₱1,250.00');
    expect(formatPeso(125050)).toBe('₱1,250.50');
    expect(formatPeso(0)).toBe('₱0.00');
    expect(formatPeso(5)).toBe('₱0.05');
    expect(formatPeso(999999999)).toBe('₱9,999,999.99');
    expect(formatPeso(100000000)).toBe('₱1,000,000.00');
  });

  it('drops .00 in compact mode but keeps real centavos', () => {
    expect(formatPeso(125000, { compact: true })).toBe('₱1,250');
    expect(formatPeso(125050, { compact: true })).toBe('₱1,250.50');
  });

  it('shows the sign of negative and, when asked, positive amounts', () => {
    expect(formatPeso(-35000, { compact: true })).toBe('-₱350');
    expect(formatPeso(50000, { compact: true, signed: true })).toBe('+₱500');
    expect(formatPeso(0, { compact: true, signed: true })).toBe('₱0');
  });
});
