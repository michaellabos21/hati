// Money helpers. Amounts are integer centavos everywhere in the app; pesos with decimals only
// exist at the edges (user input, the database's numeric(12,2) columns, and display).

/**
 * Parses what a user typed ("1,250.50", "₱ 600", "600.5") into centavos.
 * Works on the digits directly so no floating-point arithmetic is involved.
 * Returns null for anything that is not a non-negative peso amount with at most 2 decimals.
 */
export function parseAmountToCentavos(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]/g, '');
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  if (whole === '' && fraction === '') return null;
  if (whole.length > 9) return null;
  return Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0') || '0');
}

/** Converts a numeric(12,2) value from the database (number or string) into centavos. */
export function numericToCentavos(value: number | string): number {
  if (typeof value === 'number') {
    // The value already has at most 2 decimals, so rounding only removes binary noise.
    return Math.round(value * 100);
  }
  const negative = value.trim().startsWith('-');
  const centavos = parseAmountToCentavos(value.trim().replace(/^-/, ''));
  if (centavos === null) {
    throw new Error(`Not a money amount: ${value}`);
  }
  return negative ? -centavos : centavos;
}

/** Formats centavos as a plain decimal string for the database, e.g. 125050 -> "1250.50". */
export function centavosToNumeric(centavos: number): string {
  const sign = centavos < 0 ? '-' : '';
  const absolute = Math.abs(centavos);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

type FormatOptions = {
  /** Drop ".00" on whole-peso amounts: ₱1,250 instead of ₱1,250.00. */
  compact?: boolean;
  /** Prefix positive amounts with "+". */
  signed?: boolean;
};

/** Formats centavos as Philippine pesos: ₱1,250.00. */
export function formatPeso(
  centavos: number,
  { compact = false, signed = false }: FormatOptions = {},
) {
  const absolute = Math.abs(centavos);
  const whole = Math.floor(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = absolute % 100;
  const decimals = compact && fraction === 0 ? '' : `.${String(fraction).padStart(2, '0')}`;
  const sign = centavos < 0 ? '-' : signed && centavos > 0 ? '+' : '';
  return `${sign}₱${whole}${decimals}`;
}
