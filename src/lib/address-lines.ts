import type { Address } from '@/types/address';

/** The API keeps one `street`: both address lines joined, at most this long. */
export const STREET_MAX_LENGTH = 256;
export const SECOND_LINE_MAX_LENGTH = 120;
/** The API's limit for the courier note. */
export const NOTE_MAX_LENGTH = 500;

export const joinAddressLines = (line1: string, line2: string) =>
  [line1.trim(), line2.trim()].filter(Boolean).join(', ');

/** Older rows used "-" for an unknown part. */
const hasAddressPart = (value?: string | null): value is string => !!value && value.trim() !== '-';

/** Countries that write the house number before the street ("10 Downing Street"). */
const NUMBER_FIRST_COUNTRIES = new Set(['GB', 'IE', 'US', 'CA', 'AU', 'NZ', 'FR', 'ZA']);

/**
 * A first address line from a geocoded street and house number, in the order
 * that country writes it: "10 Downing Street", "Moda Cd. No: 5".
 */
export const composeFirstLine = (street: string, building: string, countryCode?: string) => {
  if (!building) return street;
  if (!street) return building;
  const country = countryCode?.toUpperCase() ?? '';
  if (NUMBER_FIRST_COUNTRIES.has(country)) return `${building} ${street}`;
  if (country === 'TR') return `${street} No: ${building}`;
  return `${street} ${building}`;
};

/**
 * A saved address's first line. New addresses keep the whole line in `street`;
 * older ones still carry the building number apart.
 */
export const formatAddressFirstLine = (address: Pick<Address, 'street' | 'buildingNumber'>) =>
  hasAddressPart(address.buildingNumber) ? `${address.street}, ${address.buildingNumber}` : address.street;
