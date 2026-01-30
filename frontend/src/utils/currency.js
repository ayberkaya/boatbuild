/**
 * Shared currency formatting for BoatBuild CRM
 * tr-TR locale, kuruş (cent) precision, multi-currency support
 */

const DEFAULT_LOCALE = 'tr-TR';
const DEFAULT_FRACTION_DIGITS = 2;

/**
 * Format a single amount in the given currency (tr-TR, kuruş precision).
 * @param {number|string} amount - Numeric amount
 * @param {string} currency - ISO 4217 code (TRY, EUR, USD, etc.)
 * @param {{ minimumFractionDigits?: number, maximumFractionDigits?: number }} options
 * @returns {string} Formatted string e.g. "1.234,56 ₺"
 */
export function formatCurrency(amount, currency = 'TRY', options = {}) {
  if (amount == null || amount === '') return formatCurrency(0, currency, options);
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(num)) return formatCurrency(0, currency, options);
  const minFrac = options.minimumFractionDigits ?? DEFAULT_FRACTION_DIGITS;
  const maxFrac = options.maximumFractionDigits ?? DEFAULT_FRACTION_DIGITS;
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: currency || 'TRY',
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  }).format(num);
}

/**
 * Format multiple currencies from an object { TRY: 1000, EUR: 500 }.
 * Used for totals that are split by currency.
 * @param {Record<string, number>} valuesByCurrency - e.g. { TRY: 1000, EUR: 500 }
 * @param {object} options - Passed to formatCurrency
 * @returns {string[]} Array of formatted strings, one per currency with value > 0
 */
export function formatCurrencyMulti(valuesByCurrency, options = {}) {
  if (!valuesByCurrency || typeof valuesByCurrency !== 'object') {
    return [formatCurrency(0, 'TRY', options)];
  }
  const currencies = Object.keys(valuesByCurrency).filter(
    (c) => valuesByCurrency[c] != null && Number(valuesByCurrency[c]) > 0
  );
  if (currencies.length === 0) {
    return [formatCurrency(0, 'TRY', options)];
  }
  return currencies.map((currency) =>
    formatCurrency(valuesByCurrency[currency], currency, options)
  );
}
