'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Plus, Trash2, X, Edit2, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Address } from '@/types/address';
import { userService } from '@/services/user.service';
import { walletService } from '@/services/wallet.service';
import { PendingSurveys } from '@/components/surveys/PendingSurveys';
import { useTranslation } from 'react-i18next';
import { AddressForm } from '@/components/address/AddressForm';
import { Suspense } from 'react';
import {
  formatCurrency,
  formatOrderDate,
  formatOrderDateTime,
  getOrderDisplayId,
  getOrderItemDetailLines,
  getOrderItemQty,
  getOrderItemTotalPrice,
  getOrderItemUnitPrice,
} from '@/lib/order-display';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { user, addresses, refreshAddresses, isLoading: isContextLoading } = useUser();
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [orders, setOrders] = useState<import('@/services/order.service').Order[]>([]);
  const [activeTab, setActiveTab] = useState<'addresses' | 'orders' | 'surveys'>('addresses');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderDetails, setOrderDetails] = useState<Record<string, import('@/services/order.service').OrderDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
      if (user) {
          walletService.getBalance()
              .then((b) => setWalletBalance(b.balance))
              .catch(() => setWalletBalance(null));
      }
  }, [user]);

  useEffect(() => {
      if (user) {
          import('@/services/order.service').then(({ orderService }) => {
              orderService.getMyOrders().then(setOrders).catch(console.error);
          });
      }
  }, [user]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'orders' || tab === 'addresses' || tab === 'surveys') {
        setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('action') === 'new' && !isAddingAddress) {
        // Build valid URL without the query param to prevent loop/re-trigger if needed, or just set state
        setTimeout(() => setIsAddingAddress(true), 0);
    }
  }, [searchParams, isAddingAddress]);

  const onEditClick = (addr: Address) => {
      setEditingId(addr.id);
      setIsAddingAddress(true);
  };

  const onCancelEdit = () => {
      setIsAddingAddress(false);
      setEditingId(null);
  };

  const handleSuccess = async () => {
      await refreshAddresses();
      setIsAddingAddress(false);
      setEditingId(null);
  };
   
  const onDeleteAddress = async (id: string) => {
      if(!confirm('Are you sure you want to delete this address?')) return;
       try {
           await userService.deleteAddress(id);
           await refreshAddresses();
       } catch (error) {
          console.error('Failed to delete', error);
          alert(t('profile.deleteFailed'));
      }
  }

  const toggleOrder = async (orderId: string) => {
      const newExpanded = new Set(expandedOrders);
      if (newExpanded.has(orderId)) {
          newExpanded.delete(orderId);
          setExpandedOrders(newExpanded);
          return;
      }

      newExpanded.add(orderId);
      setExpandedOrders(newExpanded);

      if (!orderDetails[orderId]) {
          const order = orders.find(o => o.id === orderId);
          if (!order) return;

          setLoadingDetails(prev => new Set(prev).add(orderId));
          try {
              const { orderService } = await import('@/services/order.service');
              const details = await orderService.getOrderById(orderId, order.branchId, order.brandId);
              setOrderDetails(prev => ({ ...prev, [orderId]: details }));
          } catch (error) {
              console.error('Failed to fetch order details', error);
          } finally {
              setLoadingDetails(prev => {
                  const next = new Set(prev);
                  next.delete(orderId);
                  return next;
              });
          }
      }
  };

  const openOrderDetails = (order: import('@/services/order.service').Order) => {
      const params = new URLSearchParams();
      if (order.branchId) params.set('branchId', order.branchId);
      if (order.brandId) params.set('brandId', order.brandId);

      const query = params.toString();
      router.push(`/orders/${order.id}${query ? `?${query}` : ''}`);
  };

  if (isContextLoading && !user) {
       return <div className="min-h-screen flex items-center justify-center pt-20">{t('profile.loading')}</div>;
  }

  if (!user && !isContextLoading) {
      router.push('/login');
      return null;
  }

  if (!user) return null;

  // Find the address object if we are editing
  const editingAddress = editingId ? addresses.find(a => a.id === editingId) : undefined;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('profile.personalInfo')}</CardTitle>
                    <CardDescription>{t('profile.accountDetails')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-zinc-500 uppercase">{t('profile.name')}</label>
                        <div className="font-medium text-zinc-900">{user?.firstName} {user?.lastName}</div>
                    </div>
                     <div>
                        <label className="text-xs font-medium text-zinc-500 uppercase">{t('profile.email')}</label>
                        <div className="font-medium text-zinc-900 break-all">{user?.email}</div>
                    </div>
                     <div>
                        <label className="text-xs font-medium text-zinc-500 uppercase pr-1">{t('profile.role')}</label>
                        <div className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium capitalize">
                            {user?.role}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('profile.loyaltyTitle')}</CardTitle>
                    <CardDescription>{t('profile.loyaltySubtitle')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                        {walletBalance === null ? '—' : formatCurrency(walletBalance)}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-zinc-500">
                        {t('profile.loyaltyNote')}
                    </p>
                </CardContent>
            </Card>
        </div>
        <div className="space-y-6">
            <div className="flex space-x-1 bg-zinc-100 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('addresses')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'addresses' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                >
                    {t('profile.tabs.addresses')}
                </button>
                <button
                    onClick={() => setActiveTab('orders')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'orders' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                >
                    {t('profile.tabs.orders')}
                </button>
                <button
                    onClick={() => setActiveTab('surveys')}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'surveys' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                >
                    {t('survey.tab')}
                </button>
            </div>

            {activeTab === 'surveys' && (
                <div className="space-y-6">
                    <div>
                        <h3 className="font-semibold text-zinc-900">{t('survey.title')}</h3>
                        <p className="mt-1 text-sm text-zinc-500">{t('survey.subtitle')}</p>
                    </div>
                    <PendingSurveys />
                </div>
            )}

            {activeTab === 'orders' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('profile.orderHistory')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {orders.length === 0 ? (
                                <p className="text-zinc-500 text-sm">{t('profile.noOrders')}</p>
                            ) : (
                                <div className="space-y-4">
                                    {orders.map(order => (
                                        <div key={order.id} className="border-b border-zinc-100 last:border-0">
                                            <div 
                                                className="flex justify-between items-center py-4 cursor-pointer hover:bg-zinc-50 transition-colors px-2 -mx-2 rounded-lg"
                                                onClick={() => toggleOrder(order.id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-full bg-zinc-100 text-zinc-500 transition-transform duration-200 ${expandedOrders.has(order.id) ? 'rotate-180' : ''}`}>
                                                        <ChevronDown className="h-4 w-4" />
                                                    </div>
                                                    <div> 
                                                        <div className="font-medium text-zinc-900">
                                                            {formatOrderDateTime(order.createdAt)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-xs px-2 py-1 rounded-full bg-zinc-100 text-zinc-600 inline-block capitalize mt-1">
                                                        {order.status}
                                                    </div>
                                                <div className="text-right">
                                                    <div className="font-medium text-zinc-900">
                                                        {formatCurrency(order.totalPrice)}
                                                    </div>
                                                    
                                                </div>
                                            </div>
                                            {expandedOrders.has(order.id) && (
                                                <div className="pb-4 pl-12 pr-4 space-y-3">
                                                    {loadingDetails.has(order.id) ? (
                                                        <div className="text-sm text-zinc-500 py-2">{t('profile.loadingDetails')}</div>
                                                    ) : orderDetails[order.id] ? (
                                                        <div className="space-y-2">
                                                            {orderDetails[order.id].items.map((item) => (
                                                                <div key={item.id} className="flex justify-between gap-4 text-sm">
                                                                    <div className="min-w-0 text-zinc-600">
                                                                        <div>
                                                                            <span className="font-medium text-zinc-900">{getOrderItemQty(item)}x</span> {item.productName}
                                                                        </div>
                                                                        <div className="text-xs text-zinc-500">
                                                                            {t('profile.unit')}: {formatCurrency(getOrderItemUnitPrice(item))}
                                                                        </div>
                                                                        {getOrderItemDetailLines(item).map((line) => (
                                                                            <div key={line} className="text-xs text-zinc-500 leading-relaxed">
                                                                                {line}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <div className="shrink-0 text-zinc-900 font-medium">
                                                                        {formatCurrency(getOrderItemTotalPrice(item))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <div className="pt-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => openOrderDetails(order)}
                                                                >
                                                                    {t('profile.viewOrderDetails')}
                                                                </Button>
                                                            </div>
                                                            <div className="border-t border-zinc-100 mt-2 pt-2 flex justify-between items-center">
                                                                <span className="text-sm font-medium text-zinc-900">{t('profile.total')}</span>
                                                                <span className="text-base font-bold text-orange-600">{formatCurrency(orderDetails[order.id].totalPrice)}</span>
                                                            </div>
                                                            <div className="text-xs text-zinc-500">{t('profile.orderNo', { id: getOrderDisplayId(orderDetails[order.id]) })}</div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-red-500">{t('profile.failedLoadDetails')}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'addresses' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-zinc-900">{t('profile.savedAddresses')}</h2>
                        <Button onClick={isAddingAddress ? onCancelEdit : () => setIsAddingAddress(true)} size="sm" variant={isAddingAddress ? "outline" : "primary"}>
                            {isAddingAddress ? <><X className="h-4 w-4 mr-2"/> {t('profile.cancel')}</> : <><Plus className="h-4 w-4 mr-2"/> {t('profile.addNew')}</>}
                        </Button>
                    </div>

                    {isAddingAddress && (
                        <Card className="border-zinc-200 bg-white shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-base">{editingId ? t('profile.editAddress') : t('profile.newAddress')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AddressForm 
                                    initialValues={editingAddress ? { ...editingAddress, phoneE164: editingAddress.phoneE164 ?? '' } : undefined}
                                    addressId={editingId}
                                    onCancel={onCancelEdit}
                                    onSuccess={handleSuccess}
                                />
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid gap-4">
                        {addresses.length === 0 && !isAddingAddress && (
                            <div className="text-center py-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                                <MapPin className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
                                <p className="text-zinc-500">{t('profile.noAddresses')}</p>
                            </div>
                        )}

                        {addresses.map((addr, index) => (
                            <div key={addr.id || index} className="bg-white p-4 rounded-xl border border-zinc-200 hover:border-orange-300 transition-colors flex items-start justify-between group">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 bg-orange-100 text-orange-600 p-2 rounded-lg">
                                        <MapPin className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
                                            {addr.street} {addr.buildingNumber}/{addr.apartmentNumber}<br />
                                            {addr.postalCode} {addr.district}, {addr.province}<br/>
                                            {addr.phoneE164 ? <>{addr.phoneE164}<br /></> : null}
                                            {addr.countryCode}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                     <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-500 hover:text-orange-600 hover:bg-orange-50" onClick={() => onEditClick(addr)}>
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                     <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => onDeleteAddress(addr.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center pt-20">Loading profile...</div>}>
            <ProfileContent />
        </Suspense>
    );
}
