/**
 * Loyalty / promotion API error handling.
 *
 * The backend returns a machine readable `code` alongside a technical `message`.
 * We always branch on `code` — never on the message text — and we never surface
 * the provider payload in `data` to the user.
 */

export const LOYALTY_ERROR_CODES = [
  'LOYALTY_PROMOTION_NOT_APPLICABLE',
  'LOYALTY_PROMOTION_NOT_OWNED',
  'LOYALTY_PROMOTION_INACTIVE',
  'LOYALTY_PROMOTIONS_NOT_COMBINABLE',
  'LOYALTY_PROMOTION_NOT_FOUND_ON_CART',
  'LOYALTY_PROMOTION_NO_LONGER_APPLICABLE',
  'LOYALTY_EXTERNAL_PROVIDER_NOT_ACTIVE',
] as const;

export type LoyaltyErrorCode = (typeof LOYALTY_ERROR_CODES)[number];

/** Codes that mean the cart on the server no longer matches what we are showing. */
export const CART_STALE_LOYALTY_CODES: readonly LoyaltyErrorCode[] = [
  'LOYALTY_PROMOTION_NO_LONGER_APPLICABLE',
];

type LoyaltyErrorBody = {
  message?: string | string[];
  code?: string;
  statusCode?: number;
};

type LoyaltyErrorLike = {
  response?: {
    status?: number;
    data?: LoyaltyErrorBody | null;
  };
};

export const getApiErrorCode = (error: unknown): string | undefined => {
  const code = (error as LoyaltyErrorLike)?.response?.data?.code;
  return typeof code === 'string' && code ? code : undefined;
};

export const getApiErrorStatus = (error: unknown): number | undefined =>
  (error as LoyaltyErrorLike)?.response?.status;

/** Backend `message`, normalised to a single string. Never includes the `data` payload. */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const message = (error as LoyaltyErrorLike)?.response?.data?.message;

  if (Array.isArray(message)) {
    return message.join(' ') || fallback;
  }

  return typeof message === 'string' && message.trim() ? message : fallback;
};

export const isLoyaltyErrorCode = (code: string | undefined): code is LoyaltyErrorCode =>
  Boolean(code) && (LOYALTY_ERROR_CODES as readonly string[]).includes(code as string);

export const isCartStaleLoyaltyError = (error: unknown) => {
  const code = getApiErrorCode(error);
  return isLoyaltyErrorCode(code) && CART_STALE_LOYALTY_CODES.includes(code);
};

/** A loyalty error surfaced anywhere in the flow (including checkout validation). */
export const isLoyaltyError = (error: unknown) => isLoyaltyErrorCode(getApiErrorCode(error));

/** i18n key for a known loyalty code, or `null` so callers fall back to the API message. */
export const getLoyaltyErrorTranslationKey = (code: string | undefined) =>
  isLoyaltyErrorCode(code) ? `cart.loyalty.errors.${code}` : null;

/**
 * Resolves the user facing text for a promotion failure: mapped copy when the
 * code is known, otherwise the backend message through the generic fallback.
 */
export const resolveLoyaltyErrorMessage = (
  error: unknown,
  translate: (key: string) => string,
  fallbackKey: string,
) => {
  const key = getLoyaltyErrorTranslationKey(getApiErrorCode(error));

  if (key) {
    return translate(key);
  }

  return getApiErrorMessage(error, translate(fallbackKey));
};
