import { parseMoneyToCents } from './MoneyUtil';

/**
 * Reusable currency parsing for UI values such as "$1,234.56".
 *
 * Returns a number for backward compatibility with existing Page Objects.
 * New monetary calculations should use parseMoneyToCents() directly.
 */
export function parseCurrency(value: string): number {
  return parseMoneyToCents(value) / 100;
}
