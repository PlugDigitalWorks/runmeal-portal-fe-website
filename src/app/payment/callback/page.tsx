import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { PaymentCallbackView } from './PaymentCallbackView';

export default function PaymentCallbackPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-zinc-50">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
        }>
            <PaymentCallbackView />
        </Suspense>
    );
}
