'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { authService } from '@/services/auth.service';
import { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';

function VerifyEmailContent() {
    const { t } = useTranslation();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const verificationAttempted = useRef(false);

    // Get params
    // 1. Token flow: ?token=XYZ (Frontend verifies)
    // 2. Redirect flow: ?status=success|error (Backend verified and redirected)
    const token = searchParams.get('token');
    const paramStatus = searchParams.get('status');
    const paramMessage = searchParams.get('message');

    useEffect(() => {
        const verify = async () => {
             if (verificationAttempted.current) return;
             verificationAttempted.current = true;

             if (token) {
                 try {
                     await authService.verifyEmail(token);
                     setStatus('success');
                 } catch (err) {
                     const error = err as AxiosError<{ message: string }>;
                     console.error('Verification error', error);
                     setStatus('error');
                     setMessage(error.response?.data?.message || t('verifyEmail.failedDefault'));
                 }
             } else if (paramStatus) {
                 if (paramStatus === 'success') {
                     setStatus('success');
                 } else {
                     setStatus('error');
                     setMessage(paramMessage || t('verifyEmail.failedGeneric'));
                 }
             } else {
                 setStatus('error');
                 setMessage(t('verifyEmail.noToken'));
             }
        };

        verify();
    }, [token, paramStatus, paramMessage, t]);

    return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-zinc-200 shadow-lg">
                <CardContent className="pt-6 pb-8 px-6 flex flex-col items-center text-center">
                    
                    {status === 'loading' && (
                        <>
                            <div className="h-20 w-20 bg-orange-50 rounded-full flex items-center justify-center mb-6">
                                <Loader2 className="h-10 w-10 text-orange-600 animate-spin" />
                            </div>
                            <h1 className="text-2xl font-bold text-zinc-900 mb-2">{t('verifyEmail.verifyingTitle')}</h1>
                            <p className="text-zinc-500">
                                {t('verifyEmail.verifyingText')}
                            </p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                             <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle2 className="h-10 w-10 text-green-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-zinc-900 mb-2">{t('verifyEmail.successTitle')}</h1>
                            <p className="text-zinc-500 mb-8">
                                {t('verifyEmail.successText')}
                            </p>
                            <Button
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11"
                                onClick={() => router.push('/login')}
                            >
                                {t('verifyEmail.continueToLogin')}
                            </Button>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                             <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                                <XCircle className="h-10 w-10 text-red-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-zinc-900 mb-2">{t('verifyEmail.failedTitle')}</h1>
                            <p className="text-zinc-500 mb-8">
                                {message}
                            </p>
                            <div className="w-full space-y-3">
                                <Button
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11"
                                    onClick={() => router.push('/login')}
                                >
                                    {t('verifyEmail.backToLogin')}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full h-11 border-zinc-200"
                                    onClick={() => router.push('/contact')}
                                >
                                    {t('verifyEmail.contactSupport')}
                                </Button>
                            </div>
                        </>
                    )}

                </CardContent>
            </Card>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
