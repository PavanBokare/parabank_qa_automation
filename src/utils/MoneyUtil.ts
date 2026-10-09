/**
 * Money is represented internally as integer cents.
 *
 * Examples:
 * "$150.00" -> 15000
 * "$25.50"  -> 2550
 * "$8.99"   -> 899
 *
 * This avoids JavaScript floating-point errors in monetary calculations.
 */

export type Cents = number;

export function parseMoneyToCents(value: string): Cents {
  const normalized = value
    .trim()
    .replace(/[$,\s]/g, '');

  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Unable to parse monetary value: "${value}"`);
  }

  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;

  const [wholePart, decimalPart = ''] = unsigned.split('.');

  const cents = Number(wholePart) * 100 + Number(decimalPart.padEnd(2, '0'));

  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Monetary value is outside the safe integer range: "${value}"`);
  }

  return negative ? -cents : cents;
}

export function amountToCents(amount: number): Cents {
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid monetary amount: "${amount}"`);
  }

  return parseMoneyToCents(amount.toFixed(2));
}

export function centsToAmount(cents: Cents): number {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Invalid cents value: "${cents}"`);
  }

  return cents / 100;
}

export function formatCents(cents: Cents): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Invalid cents value: "${cents}"`);
  }

  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);

  const dollars = Math.floor(absolute / 100);
  const remainingCents = absolute % 100;

  return `${sign}$${dollars.toLocaleString('en-US')}.${remainingCents
    .toString()
    .padStart(2, '0')}`;
}