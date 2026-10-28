/**
 * Coordinates sent to search are rounded to 3 decimals (about 100 m): the
 * visitor's exact position stays out of URLs and server logs, and nearby
 * visitors share cached results. The exact address is used only at checkout.
 */
export const roundCoordinate = (value: number) => Math.round(value * 1000) / 1000;

export interface Coordinates {
  lat: number;
  lng: number;
}

export const roundCoordinates = ({ lat, lng }: Coordinates): Coordinates => ({
  lat: roundCoordinate(lat),
  lng: roundCoordinate(lng),
});

/**
 * A distance for a restaurant card: metres rounded to 50 below 1 km ("350 m"),
 * otherwise kilometres with one decimal ("1.2 km" / "1,2 km").
 */
export function formatDistance(meters: number, language: string): string {
  const locale = language.startsWith('en') ? 'en-GB' : 'tr-TR';
  if (meters < 1000) {
    const rounded = Math.max(50, Math.round(meters / 50) * 50);
    if (rounded < 1000) {
      return new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter', unitDisplay: 'short' }).format(rounded);
    }
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    unitDisplay: 'short',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(meters / 1000);
}
