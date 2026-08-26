import i18n from '@/i18n/config';
import { CustomerStampTransaction, StampCard } from '@/types/loyalty-stamp';

/** Fresh QR needed: the signed value the app is holding is no longer accepted. */
export const STAMP_QR_INVALID_CODE = 'LOYALTY_STAMP_QR_INVALID';

export interface StampCardProgress {
    /** Stamps on the current cycle, clamped to the threshold. */
    earned: number;
    target: number;
    remaining: number;
    /** 0–100, for the bar and the ring. */
    percent: number;
    /** Reward earned and waiting: the card is full and locked until it is redeemed or expires. */
    isRewardAvailable: boolean;
}

/**
 * Backend counters are authoritative — `stampCount` / `remainingStamps` are
 * used as sent and never recomputed from transaction history. The clamping
 * here only guards the bar geometry against an out-of-range payload.
 */
export function resolveStampProgress(card: StampCard): StampCardProgress {
    const target = Math.max(1, card.stampThreshold);
    const isRewardAvailable = card.status === 'REWARD_AVAILABLE';
    const earned = isRewardAvailable ? target : Math.max(0, Math.min(card.stampCount, target));
    const remaining = isRewardAvailable ? 0 : Math.max(0, card.remainingStamps);

    return {
        earned,
        target,
        remaining,
        percent: Math.round((earned / target) * 100),
        isRewardAvailable,
    };
}

/** Falls back to the campaign name; raw UUIDs are never shown as primary copy. */
export const resolveCardTitle = (card: StampCard) =>
    card.category?.name?.trim() || card.campaignName?.trim() || i18n.t('rewards.unnamedCampaign');

export const resolveCardSubtitle = (card: StampCard) =>
    card.campaignName?.trim() || card.category?.name?.trim() || i18n.t('rewards.unnamedCampaign');

/** Leads with whatever is closest to a reward, so the featured card is the useful one. */
export const sortCardsByProgress = (cards: StampCard[]) =>
    [...cards].sort((a, b) => resolveStampProgress(b).percent - resolveStampProgress(a).percent);

export const countAvailableRewards = (cards: StampCard[]) =>
    cards.filter((card) => card.status === 'REWARD_AVAILABLE').length;

/** Reward windows are absolute instants — render them in the customer's own zone. */
export function formatStampDate(value: string | null | undefined, withTime = false): string | null {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const locale = i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR';
    return date.toLocaleString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
}

/** One history line. `EXPIRE` is a system action, so it carries no branch. */
export function resolveTransactionLabel(transaction: CustomerStampTransaction): string {
    const campaignName =
        transaction.campaign?.name?.trim() ||
        transaction.campaign?.category?.name?.trim() ||
        i18n.t('rewards.unnamedCampaign');
    const branchName = transaction.branch?.name?.trim() || i18n.t('rewards.history.unknownBranch');

    switch (transaction.type) {
        case 'ADD_STAMP':
            return i18n.t('rewards.history.addStamp', { quantity: transaction.quantity, branch: branchName });
        case 'REDEEM':
            return i18n.t('rewards.history.redeem', { campaign: campaignName, branch: branchName });
        case 'EXPIRE':
            return i18n.t('rewards.history.expire', { campaign: campaignName });
        default:
            return campaignName;
    }
}

export function resolvePerformedByLabel(transaction: CustomerStampTransaction): string | null {
    const performedBy = transaction.performedBy;
    if (!performedBy) return null;

    const name = [performedBy.firstName, performedBy.lastName].filter(Boolean).join(' ').trim();
    return name || null;
}
