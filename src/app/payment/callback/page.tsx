'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, ArrowRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCart } from '@/context/CartContext';

function PaymentCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { refreshCarts } = useCart();
    
    // Params expected from backend redirect
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    const orderId = searchParams.get('orderId');

    const isSuccess = status === 'success';

    useEffect(() => {
        if (isSuccess) {
            // Refresh cart state since items were likely purchased/removed
            refreshCarts();
        }
    }, [isSuccess, refreshCarts]);

    return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-zinc-200 shadow-lg">
                <CardContent className="pt-6 pb-8 px-6 flex flex-col items-center text-center">
                    {isSuccess ? (
                        <>
                            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle2 className="h-10 w-10 text-green-600" />
                            </div>
                            
                            <h1 className="text-2xl font-bold text-zinc-900 mb-2">Payment Successful!</h1>
                            <p className="text-zinc-500 mb-8">
                                Thank you for your order. We have received your payment and your order is being prepared.
                            </p>

                            <div className="w-full space-y-3">
                                <Button 
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11"
                                    onClick={() => router.push('/profile?tab=orders')}
                                >
                                    View My Orders
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="w-full h-11 border-zinc-200"
                                    onClick={() => router.push('/')}
                                >
                                    Back to Home
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                                <XCircle className="h-10 w-10 text-red-600" />
                            </div>
                            
                            <h1 className="text-2xl font-bold text-zinc-900 mb-2">Payment Failed</h1>
                            <p className="text-zinc-500 mb-8">
                                {message || 'Something went wrong during the payment process. Please try again.'}
                            </p>

                            <div className="w-full space-y-3">
                                <Button 
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11"
                                    onClick={() => router.push('/checkout')} // Maybe send them back to checkout to retry?
                                >
                                    Try Again
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="w-full h-11 border-zinc-200"
                                    onClick={() => router.push('/contact')}
                                >
                                    Contact Support
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function PaymentCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
        }>
            <PaymentCallbackContent />
        </Suspense>
    );
}
