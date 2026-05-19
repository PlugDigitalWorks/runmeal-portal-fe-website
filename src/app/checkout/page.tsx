import { Suspense } from 'react';
import CheckoutView from './CheckoutView';

export default function CheckoutPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading checkout...</div>}>
            <CheckoutView />
        </Suspense>
    );
}
