'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import { ChefHat } from 'lucide-react';
import { RUNMEAL_LOGO } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/auth.service';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { OtpChallenge } from '@/components/auth/OtpChallenge';
import { RecaptchaWidget } from '@/components/auth/RecaptchaWidget';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import { toast } from 'sonner';

type LoginFormValues = { email: string; password?: string };
type LoginMethod = 'otp' | 'password';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [method, setMethod] = useState<LoginMethod>('otp');
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaResetKey, setRecaptchaResetKey] = useState(0);
  const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
  const handledGoogleCallbackRef = useRef(false);

  const loginSchema = z.object({
    email: z.string().email(t('auth.validation.emailInvalid')),
    password: z.string().optional(),
  });
  const { register, handleSubmit, setError: setFieldError, clearErrors, formState: { errors } } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const resetCaptcha = () => {
    setRecaptchaToken(null);
    setRecaptchaResetKey((key) => key + 1);
  };

  const onSubmit = async (data: LoginFormValues) => {
    if (method === 'password' && !data.password) {
      setFieldError('password', { message: t('auth.validation.passwordRequired') });
      return;
    }
    if (isRecaptchaEnabled && !recaptchaToken) {
      setError(t('auth.validation.securityCheck'));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (method === 'otp') {
        await authService.requestOtpLogin(data.email, recaptchaToken ?? undefined);
        setSentEmail(data.email);
        toast.success(t('auth.otp.sent'));
      } else {
        await authService.login({ email: data.email, password: data.password, recaptchaToken: recaptchaToken ?? undefined });
        router.push('/');
        router.refresh();
      }
    } catch (requestError) {
      setError(resolveApiErrorMessage(requestError, t('auth.login.invalidCredentials')));
    } finally {
      resetCaptcha();
      setIsLoading(false);
    }
  };

  const verifyCode = async (code: string) => {
    if (!sentEmail) return;
    setIsLoading(true);
    setError(null);
    try {
      await authService.verifyOtp({ email: sentEmail, code });
      toast.success(t('auth.otp.success'));
      router.push('/');
      router.refresh();
    } catch (verifyError) {
      setError(resolveApiErrorMessage(verifyError, t('auth.validation.generic')));
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async () => {
    if (!sentEmail) return;
    if (isRecaptchaEnabled && !recaptchaToken) {
      setError(t('auth.validation.securityCheck'));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await authService.requestOtpLogin(sentEmail, recaptchaToken ?? undefined);
      toast.success(t('auth.otp.resent'));
    } catch (resendError) {
      setError(resolveApiErrorMessage(resendError, t('auth.validation.generic')));
    } finally {
      resetCaptcha();
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (handledGoogleCallbackRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    if (!authStatus) return;
    handledGoogleCallbackRef.current = true;
    const reason = params.get('reason');
    window.history.replaceState(null, '', '/login');
    if (authStatus === 'success') {
      setIsLoading(true);
      setError(null);
      authService.completeGoogleLogin()
        .then(() => { router.push('/'); router.refresh(); })
        .catch(() => setError(t('auth.login.googleRestoreError')))
        .finally(() => setIsLoading(false));
      return;
    }
    setError(reason || t('auth.login.googleFailed'));
  }, [router, t]);

  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-900 p-12 md:flex md:w-1/2">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-orange-600/20 to-zinc-900/0" />
        <div className="relative z-10"><div className="mb-8"><Image src={RUNMEAL_LOGO} alt="Runmeal" width={160} height={40} className="h-10 w-auto rounded-lg bg-white px-3 py-2" priority /></div><h2 className="max-w-lg text-4xl font-bold leading-tight text-white">{t('auth.login.heroTitle')}</h2></div>
        <div className="relative z-10 text-sm text-zinc-400">{t('auth.footer')}</div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-8">
          {sentEmail ? (
            <OtpChallenge
              email={sentEmail}
              error={error}
              isLoading={isLoading}
              onVerify={verifyCode}
              onResend={resendCode}
              onBack={() => { setSentEmail(null); setError(null); resetCaptcha(); }}
              resendDisabled={isRecaptchaEnabled && !recaptchaToken}
              resendVerification={<RecaptchaWidget onTokenChange={setRecaptchaToken} resetKey={recaptchaResetKey} />}
            />
          ) : (
            <>
              <div className="text-center md:text-left"><div className="mb-6 flex justify-center md:hidden"><ChefHat className="h-10 w-10 text-orange-600" /></div><h1 className="text-3xl font-bold tracking-tight text-zinc-900">{t('auth.login.title')}</h1><p className="mt-2 text-zinc-500">{t('auth.login.subtitle')}</p></div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <GoogleAuthButton disabled={isLoading} onError={setError} />
                <div className="relative py-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div><div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-zinc-500">{t('auth.login.orEmail')}</span></div></div>
                {error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-500">{error}</div>}
                <Input label={t('auth.email')} type="email" autoComplete="email" placeholder={t('auth.emailPlaceholder')} className="text-zinc-900" error={errors.email?.message} {...register('email')} />
                {method === 'password' && <div className="space-y-1"><Input label={t('auth.password')} type="password" autoComplete="current-password" placeholder="••••••••" className="text-zinc-900" error={errors.password?.message} {...register('password')} /><div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-medium text-orange-600 hover:text-orange-500 hover:underline">{t('auth.login.forgot')}</Link></div></div>}
                <RecaptchaWidget onTokenChange={setRecaptchaToken} resetKey={recaptchaResetKey} />
                <Button type="submit" className="w-full" isLoading={isLoading} size="lg" disabled={isRecaptchaEnabled && !recaptchaToken}>{method === 'otp' ? t('auth.otp.sendCode') : t('auth.login.submit')}</Button>
                <button type="button" onClick={() => { setMethod(method === 'otp' ? 'password' : 'otp'); clearErrors(); setError(null); resetCaptcha(); }} className="w-full text-sm font-medium text-orange-600 hover:text-orange-500">{method === 'otp' ? t('auth.otp.usePassword') : t('auth.otp.useCode')}</button>
              </form>
              <p className="text-center text-sm text-zinc-600">{t('auth.login.noAccount')} <Link href="/register" className="font-medium text-orange-600 hover:text-orange-500 hover:underline">{t('auth.login.createAccount')}</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
