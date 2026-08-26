'use client';

import React from 'react';
import { branchService } from '@/services/branch.service';
import type { FulfillmentSlotsResponse, ScheduledOrderType } from '@/types/branch';
import { useTranslation } from 'react-i18next';

interface FulfillmentSlotPickerProps {
    branchId: string;
    orderType: ScheduledOrderType;
    selectedValue: string | null;
    onChange: (value: string | null) => void;
    onStatusChange?: (status: { isLoading: boolean; hasSlots: boolean }) => void;
    refreshKey?: number;
}

export function FulfillmentSlotPicker({
    branchId,
    orderType,
    selectedValue,
    onChange,
    onStatusChange,
    refreshKey = 0,
}: FulfillmentSlotPickerProps) {
    const { t } = useTranslation();
    const [data, setData] = React.useState<FulfillmentSlotsResponse | null>(null);
    const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [hasError, setHasError] = React.useState(false);
    const [localRefreshKey, setLocalRefreshKey] = React.useState(0);
    const selectionRef = React.useRef(selectedValue);
    const onChangeRef = React.useRef(onChange);
    const onStatusChangeRef = React.useRef(onStatusChange);
    const previousScopeRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        selectionRef.current = selectedValue;
        onChangeRef.current = onChange;
        onStatusChangeRef.current = onStatusChange;
    }, [selectedValue, onChange, onStatusChange]);

    React.useEffect(() => {
        const scope = `${branchId}:${orderType}`;
        if (previousScopeRef.current !== scope) {
            previousScopeRef.current = scope;
            onChangeRef.current(null);
            setSelectedDate(null);
        }

        let cancelled = false;
        setIsLoading(true);
        setHasError(false);
        onStatusChangeRef.current?.({ isLoading: true, hasSlots: false });

        branchService.getFulfillmentSlots(branchId, orderType)
            .then((response) => {
                if (cancelled) return;
                setData(response);
                const hasSlots = response.available && response.dates.some((entry) => entry.slots.length > 0);
                const currentSelection = selectionRef.current;
                const selectedEntry = response.dates.find((entry) =>
                    entry.slots.some((slot) => slot.value === currentSelection),
                );
                if (currentSelection && !selectedEntry) onChangeRef.current(null);
                setSelectedDate((currentDate) =>
                    selectedEntry?.date
                    ?? (response.dates.some((entry) => entry.date === currentDate) ? currentDate : response.dates[0]?.date ?? null),
                );
                onStatusChangeRef.current?.({ isLoading: false, hasSlots });
            })
            .catch((error) => {
                if (cancelled) return;
                console.error('Failed to load fulfillment slots', error);
                setData(null);
                setHasError(true);
                onChangeRef.current(null);
                onStatusChangeRef.current?.({ isLoading: false, hasSlots: false });
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [branchId, orderType, refreshKey, localRefreshKey]);

    if (isLoading) {
        return <p className="text-sm text-zinc-500">{t('fulfillment.loadingSlots')}</p>;
    }

    if (hasError) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <p>{t('fulfillment.slotsError')}</p>
                <button type="button" onClick={() => setLocalRefreshKey((key) => key + 1)} className="mt-2 font-semibold underline">
                    {t('fulfillment.retry')}
                </button>
            </div>
        );
    }

    if (!data?.available || !data.dates.some((entry) => entry.slots.length > 0)) {
        return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t('fulfillment.noSlots')}</p>;
    }

    const slots = data.dates.find((entry) => entry.date === selectedDate)?.slots ?? [];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2" aria-label={t('fulfillment.dateLabel')}>
                {data.dates.filter((entry) => entry.slots.length > 0).map((entry) => (
                    <button
                        type="button"
                        key={entry.date}
                        onClick={() => {
                            setSelectedDate(entry.date);
                            onChange(null);
                        }}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${selectedDate === entry.date
                            ? 'border-orange-600 bg-orange-50 text-orange-700'
                            : 'border-zinc-200 text-zinc-700 hover:border-orange-300'}`}
                    >
                        {entry.date}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label={t('fulfillment.timeLabel')}>
                {slots.map((slot) => (
                    <button
                        type="button"
                        key={slot.value}
                        onClick={() => onChange(slot.value)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${selectedValue === slot.value
                            ? 'border-orange-600 bg-orange-600 text-white'
                            : 'border-zinc-200 text-zinc-700 hover:border-orange-300'}`}
                    >
                        {slot.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
