'use client';

import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CreditCard, MapPin, Package, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { branchService } from '@/services/branch.service';
import { Order, OrderDetails } from '@/services/order.service';
import { Branch } from '@/types/branch';
import {
  formatCurrency,
  formatOrderDateTime,
  getOrderDisplayId,
  getOrderItemDetailLines,
  getOrderItemQty,
  getOrderItemTotalPrice,
  getOrderItemUnitPrice,
  getOrderSubtotal,
  toNumber,
} from '@/lib/order-display';

function formatPaymentMethod(value: string | null | undefined) {
  if (!value) return '-';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getOrderTimeLabel(order: OrderDetails) {
  const completedAt = order.deliveredAt || order.completedAt;
  if (completedAt) return `${formatOrderDateTime(completedAt)} tarihinde teslim edildi`;
  return `${formatOrderDateTime(order.createdAt)} tarihinde sipariş verildi`;
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadOrder() {
      if (!orderId) return;

      setLoading(true);
      setError(null);

      try {
        const { orderService } = await import('@/services/order.service');
        let branchId = searchParams.get('branchId') || '';
        let brandId = searchParams.get('brandId') || '';
        let listOrder: Order | undefined;

        if (!branchId || !brandId) {
          const orders = await orderService.getMyOrders();
          listOrder = orders.find((item) => item.id === orderId);
          branchId = branchId || listOrder?.branchId || '';
          brandId = brandId || listOrder?.brandId || '';
        }

        if (!branchId || !brandId) {
          throw new Error('Order branch information is missing.');
        }

        const details = await orderService.getOrderById(orderId, branchId, brandId);
        if (!mounted) return;
        setOrder(details);

        try {
          const branchDetails = await branchService.getBranchDetails(branchId);
          if (mounted) setBranch(branchDetails);
        } catch (branchError) {
          console.error('Failed to fetch branch details', branchError);
          if (mounted) setBranch(null);
        }
      } catch (loadError) {
        console.error('Failed to fetch order detail', loadError);
        if (mounted) setError('Order details could not be loaded.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOrder();

    return () => {
      mounted = false;
    };
  }, [orderId, searchParams]);

  const subtotal = useMemo(() => getOrderSubtotal(order ?? ({} as Order), order?.items ?? []), [order]);
  const deliveryFee = toNumber(order?.deliveryFee);
  const discountAmount = toNumber(order?.discountAmount);
  const taxAmount = toNumber(order?.taxAmount);
  const branchName = branch?.name || order?.branchName || 'Branch';
  const branchAddress = branch?.addressText || order?.branchAddressText || '-';
  const logoUrl = branch?.logoUrl || order?.branchLogoUrl || '/logo.svg';

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center pt-20">Loading order details...</div>;
  }

  if (error || !order) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-red-600">
            {error || 'Order details could not be loaded.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                  <Image
                    src={logoUrl}
                    alt={branchName}
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-zinc-950">{branchName}</h1>
                      <p className="mt-1 text-sm text-zinc-600">{getOrderTimeLabel(order)}</p>
                      <p className="mt-1 text-sm font-medium text-zinc-700">
                        Sipariş #{getOrderDisplayId(order)}
                      </p>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium capitalize text-zinc-700">
                      {order.status}
                    </span>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                      <div>
                        <p className="text-sm text-zinc-500">Siparişin verildiği yer:</p>
                        <p className="font-medium text-zinc-950">{branchName}</p>
                        <p className="text-sm text-zinc-600">{branchAddress}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                      <div>
                        <p className="text-sm text-zinc-500">Teslim edildiği yer:</p>
                        <p className="font-medium text-zinc-950">{order.addressText || '-'}</p>
                        {order.phone ? <p className="text-sm text-zinc-600">{order.phone}</p> : null}
                      </div>
                    </div>
                    {order.note ? (
                      <div className="flex gap-3">
                        <ReceiptText className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                        <div>
                          <p className="text-sm text-zinc-500">Sipariş notu:</p>
                          <p className="text-sm font-medium text-zinc-950">{order.note}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-orange-600" />
                Sipariş özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-zinc-950">
                            {getOrderItemQty(item)}x {item.productName}
                          </p>
                          <p className="text-xs text-zinc-500">
                            Unit: {formatCurrency(getOrderItemUnitPrice(item))}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold text-zinc-950">
                          {formatCurrency(getOrderItemTotalPrice(item))}
                        </p>
                      </div>
                      {getOrderItemDetailLines(item).map((line) => (
                        <p key={line} className="mt-1 text-sm leading-relaxed text-zinc-600">
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-zinc-200 pt-5">
                <div className="flex justify-between text-zinc-700">
                  <span>Ara Toplam</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-700">
                  <span>Teslimat Ücreti</span>
                  <span>{deliveryFee > 0 ? formatCurrency(deliveryFee) : 'Free'}</span>
                </div>
                {discountAmount > 0 ? (
                  <div className="flex justify-between text-emerald-600">
                    <span>İndirim</span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                ) : null}
                {taxAmount > 0 ? (
                  <div className="flex justify-between text-zinc-700">
                    <span>KDV dahil</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                ) : null}
                {order.couponCode ? (
                  <div className="flex justify-between text-zinc-700">
                    <span>Kupon</span>
                    <span>{order.couponCode}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-zinc-200 pt-3 text-lg font-bold text-zinc-950">
                  <span>Toplam</span>
                  <span className="text-orange-600">{formatCurrency(order.totalPrice)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-200 pt-5">
                <div className="flex items-center gap-2 font-medium text-zinc-950">
                  <CreditCard className="h-5 w-5 text-zinc-500" />
                  Ödeme şekli
                </div>
                <div className="text-right">
                  <p>{formatPaymentMethod(order.paymentMethod)}</p>
                  {order.paymentStatus ? (
                    <p className="text-xs capitalize text-zinc-500">{order.paymentStatus}</p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
