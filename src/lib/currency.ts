export const DEFAULT_CURRENCY_SYMBOL = '₺';

type CurrencySource = {
  currency?: string | null;
  currencySymbol?: string | null;
};

/** ISO codes we render with a symbol of their own; anything else keeps its code. */
const ISO_CURRENCY_SYMBOLS: Record<string, string> = { TRY: DEFAULT_CURRENCY_SYMBOL };

/** Turns an ISO code coming from the API into what we print, e.g. `TRY` → `₺`. */
export function resolveCurrencySymbol(currency?: string | null): string | undefined {
  const code = currency?.trim();
  if (!code) return undefined;
  return ISO_CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

export function getCurrencySymbol(source?: CurrencySource | null): string {
  const symbol = source?.currencySymbol?.trim();
  if (symbol) return symbol;

  return resolveCurrencySymbol(source?.currency) ?? DEFAULT_CURRENCY_SYMBOL;
}

export function formatCurrencyAmount(
  value: number | string | null | undefined,
  symbol: string = DEFAULT_CURRENCY_SYMBOL,
): string {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const formatted = safeAmount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const separator = /^[A-Z]{3}$/.test(symbol) ? ' ' : '';

  return `${symbol}${separator}${formatted}`;
}
