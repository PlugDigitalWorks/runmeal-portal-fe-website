# Portal UX Improvements — Design

Date: 2026-06-09

## Scope

Five small UX/correctness tasks plus an i18n migration. The five small tasks ship
first; the i18n migration is a separate, later phase.

## 1. Negative input validation

**Problem:** Some numeric inputs accept negative values. The backend rejects them, but
they should be blocked client-side.

**Current state:** Only one `type="number"` input exists: the wallet amount field in
`src/app/checkout/CheckoutView.tsx` (~line 824). Quantity controls use +/- buttons and
do not go negative.

**Plan:**
- Add a small helper `sanitizePositiveNumber(value: string): string` in `src/lib/utils.ts`
  that strips `-` and rejects negative/invalid numeric strings (keeps empty string and
  valid non-negative numbers).
- Wallet amount input: add `min={0}`, `inputMode="decimal"`, and run onChange through the
  helper.
- `handleApplyWallet`: guard that the parsed amount is `> 0` before applying.

## 2. Para Puan box (profile)

**Plan:** In `src/app/profile/page.tsx`, directly below the "Personal Info" Card, add a
new Card titled "Para Puan" that shows the loyalty balance.
- Fetch via existing `walletService.getBalance()` (`/loyalty/credit/balance`).
- Display balance using `formatCurrency` (₺). Amount only, no extra explanatory text.
- Simple loading / error handling (hide or show 0 on failure).

## 3. Default Runmeal logo for products without image

**Plan:** Copy `runmeal.png` into `public/images/runmeal.png`. When a product has no image,
render this logo instead of the "No Image" placeholder.
- `src/components/products/ProductList.tsx` (~line 85)
- `src/components/products/ProductDetailModal.tsx` (~line 217)
- Cart items (`CartDetail.tsx`, `CartDrawer.tsx`) — fallback when `item.imgUrl` is empty.
- Define a shared constant `DEFAULT_PRODUCT_IMAGE = '/images/runmeal.png'`.

## 4. Real logo in UI

**Plan:** Replace the text logo (`Runmeal`) and `/logo.svg` fallback with `runmeal.png`.
- `src/components/layout/Header.tsx` (~line 40)
- Auth pages: login, register, forgot-password, reset-password
- `src/app/orders/[orderId]/page.tsx` (~line 108) fallback path
- Use `next/image` with the copied asset.

## 5. i18n migration (later phase)

**Approach:** react-i18next, Turkish + English.
- Resource files under `public/locales/{tr,en}/common.json`.
- i18n init + provider wired into the app; `useTranslation` in components.
- Language switcher in the header.
- Migrate all hardcoded UI strings (currently mixed TR/EN) into the JSON resources.

This phase is intentionally deferred until tasks 1–4 are complete and verified.

## Out of scope

- No backend changes.
- No unrelated refactoring.
