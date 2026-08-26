'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coffee, Gift, History, Hourglass, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/context/UserContext';
import { useStampBrands, useStampCards, useStampTransactions } from '@/hooks/useLoyaltyStamps';
import { formatStampDate, resolvePerformedByLabel, resolveTransactionLabel } from '@/lib/loyalty-stamps';
import { StampTransactionQuery } from '@/services/loyalty-stamp.service';
import { CustomerStampTransaction, StampTransactionType } from '@/types/loyalty-stamp';

/**
 * Stamp activity — deliberately its own screen. These rows are loyalty events
 * from the counter, not orders, so they are never merged into order history.
 *
 * Progress is read from the cards endpoint; nothing here is summed up to
 * derive a stamp count.
 */

const TYPE_FILTERS: (StampTransactionType | 'ALL')[] = ['ALL', 'ADD_STAMP', 'REDEEM', 'EXPIRE'];

const TYPE_ICON: Record<StampTransactionType, React.ComponentType<{ size?: number; className?: string }>> = {
    ADD_STAMP: Coffee,
    REDEEM: Gift,
    EXPIRE: Hourglass,
};

function TransactionRow({ transaction }: { transaction: CustomerStampTransaction }) {
    const { t } = useTranslation();
    const Icon = TYPE_ICON[transaction.type] ?? Coffee;
    const isExpire = transaction.type === 'EXPIRE';
    const performedBy = resolvePerformedByLabel(transaction);

    return (
        <li className="flex items-start gap-3 px-4 py-3.5">
            <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isExpire ? 'bg-zinc-100 text-zinc-400' : 'bg-orange-50 text-orange-600'
                    }`}
            >
                <Icon size={16} />
            </span>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-zinc-900">{resolveTransactionLabel(transaction)}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                    {transaction.campaign?.category?.name || transaction.campaign?.name}
                    {performedBy && ` · ${performedBy}`}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-400">{formatStampDate(transaction.createdAt, true)}</p>
            </div>

            <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-500">
                {transaction.type === 'ADD_STAMP' && <span className="block text-orange-600">+{transaction.quantity}</span>}
                {t('rewards.history.stampCountAfter', { stamps: transaction.stampCountAfter })}
            </span>
        </li>
    );
}

export function StampHistoryScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { user, isLoading: isUserLoading } = useUser();
    const [typeFilter, setTypeFilter] = React.useState<StampTransactionType | 'ALL'>('ALL');
    const [categoryId, setCategoryId] = React.useState<string>('ALL');

    React.useEffect(() => {
        if (!isUserLoading && !user) router.replace('/login');
    }, [isUserLoading, user, router]);

    // Category chips come from the customer's own cards, so the filter only
    // ever offers campaigns they actually collect on.
    // History is read per brand, so the portal picks one brand at a time.
    const { brands } = useStampBrands(!!user);
    const { groups } = useStampCards(brands, !!user);
    const brandGroups = groups ?? [];
    const [brandId, setBrandId] = React.useState<string | null>(null);
    const activeBrandId = brandId && brandGroups.some((group) => group.brandId === brandId)
        ? brandId
        : brandGroups[0]?.brandId ?? null;
    const cards = brandGroups.find((group) => group.brandId === activeBrandId)?.cards ?? null;

    const filters = React.useMemo<StampTransactionQuery>(
        () => ({
            ...(typeFilter === 'ALL' ? {} : { type: typeFilter }),
            ...(categoryId === 'ALL' ? {} : { categoryId }),
        }),
        [typeFilter, categoryId],
    );

    const { transactions, isLoading, isLoadingMore, hasError, hasMore, total, loadMore, refresh } =
        useStampTransactions(activeBrandId, filters);

    const chipClass = (isActive: boolean) =>
        `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${isActive
            ? 'border-orange-600 bg-orange-50 text-orange-600'
            : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
        }`;

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => router.push('/profile?tab=rewards')}
                    aria-label={t('rewards.allCards')}
                    className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                    <h1 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
                        <History size={18} /> {t('rewards.history.title')}
                    </h1>
                    <p className="mt-0.5 text-sm text-zinc-500">{t('rewards.history.subtitle')}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="mt-6 space-y-2">
                {/* The portal customer collects stamps at several brands and the
                    backend answers per brand, so a brand has to be chosen first. */}
                {brandGroups.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {brandGroups.map((group) => (
                            <button
                                key={group.brandId}
                                type="button"
                                onClick={() => setBrandId(group.brandId)}
                                className={chipClass(group.brandId === activeBrandId)}
                            >
                                {group.label || t('rewards.unnamedBrand')}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {TYPE_FILTERS.map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setTypeFilter(type)}
                            className={chipClass(type === typeFilter)}
                        >
                            {t(`rewards.history.filters.${type}`)}
                        </button>
                    ))}
                </div>

                {cards && cards.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        <button type="button" onClick={() => setCategoryId('ALL')} className={chipClass(categoryId === 'ALL')}>
                            {t('rewards.history.filters.allCategories')}
                        </button>
                        {cards.map((card) => (
                            <button
                                key={card.campaignId}
                                type="button"
                                onClick={() => setCategoryId(card.category.id)}
                                className={chipClass(categoryId === card.category.id)}
                            >
                                {card.category.name || card.campaignName}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {hasError && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">{t('rewards.history.loadError')}</p>
                    <button
                        type="button"
                        onClick={refresh}
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                    >
                        <RefreshCw size={13} /> {t('rewards.retry')}
                    </button>
                </div>
            )}

            <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                {isLoading && transactions.length === 0 ? (
                    <div className="divide-y divide-zinc-100">
                        {[0, 1, 2].map((key) => (
                            <div key={key} className="h-[76px] animate-pulse bg-zinc-50" />
                        ))}
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
                            <History className="h-8 w-8 text-zinc-300" />
                        </div>
                        <p className="text-zinc-500">{t('rewards.history.empty')}</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-zinc-100">
                        {transactions.map((transaction) => (
                            <TransactionRow key={transaction.id} transaction={transaction} />
                        ))}
                    </ul>
                )}
            </div>

            {hasMore && (
                <button
                    type="button"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="mt-4 w-full rounded-full border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-orange-400 hover:text-orange-600 disabled:opacity-60"
                >
                    {isLoadingMore ? t('common.loading') : t('rewards.history.loadMore')}
                </button>
            )}

            {total > 0 && (
                <p className="mt-3 text-center text-[11px] text-zinc-400">
                    {t('rewards.history.count', { shown: transactions.length, total })}
                </p>
            )}
        </div>
    );
}
