export const DEFAULT_CURRENCY_SYMBOL = '₺';

type CurrencySource = {
  currency?: string | null;
  currencySymbol?: string | null;
};

export function getCurrencySymbol(source?: CurrencySource | null): string {
  const symbol = source?.currencySymbol?.trim();
  if (symbol) return symbol;

  const currency = source?.currency?.trim().toUpperCase();
  if (currency) return currency;

  return DEFAULT_CURRENCY_SYMBOL;
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
