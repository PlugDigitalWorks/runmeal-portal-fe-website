/**
 * Customer stamp loyalty ("10 kahveye 1 hediye").
 *
 * Physical-store only: stamps are earned and rewards redeemed by a manager
 * scanning the member QR at the counter. Online orders neither earn nor
 * redeem, so nothing in here is wired to the cart or the order flow.
 */

export type StampCampaignStatus = 'ACTIVE' | 'INACTIVE';
export type StampProgressStatus = 'COLLECTING' | 'REWARD_AVAILABLE';
export type StampTransactionType = 'ADD_STAMP' | 'REDEEM' | 'EXPIRE';

export interface StampCategoryRef {
  id: string;
  name: string;
}

/**
 * `GET /loyalty/stamps/me/:brandId/availability` — whether this brand runs the
 * stamp program at all. The whole wallet entry point is hidden when it is off,
 * so a brand without stamp campaigns never advertises one.
 */
export interface StampAvailability {
  isStampActive: boolean;
}

/** `GET /loyalty/stamps/qr` — the signed value the QR renderer draws. */
export interface StampQrResponse {
  qrToken: string;
  /** Absolute dashboard URL; the customer app never builds or rewrites it. */
  qrValue: string;
}

/**
 * One category campaign's progress. Counters are authoritative — never derive
 * them from transaction history and never increment them optimistically.
 */
export interface StampCard {
  campaignId: string;
  campaignName: string;
  brandId: string;
  category: StampCategoryRef;
  stampThreshold: number;
  rewardValidityDays: number;
  campaignStatus: StampCampaignStatus;
  stampCount: number;
  remainingStamps: number;
  status: StampProgressStatus;
  cycleNumber: number;
  /** Set only while `status === 'REWARD_AVAILABLE'`. */
  rewardEarnedAt: string | null;
  rewardExpiresAt: string | null;
}

export interface CustomerStampTransaction {
  id: string;
  userId: string;
  campaign: {
    id: string;
    name: string;
    category: StampCategoryRef;
  };
  /** Null on `EXPIRE`: expiry is a system action, not a branch action. */
  branch: { id: string; name: string } | null;
  performedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  type: StampTransactionType;
  quantity: number;
  stampCountAfter: number;
  cycleNumber: number;
  createdAt: string;
}
