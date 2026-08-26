'use client';

import { useState } from 'react';
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
import { OtpChallenge } from '@/components/auth/OtpChallenge';
import { RecaptchaWidget } from '@/components/auth/RecaptchaWidget';
import { resolveApiErrorMessage } from '@/lib/api-errors';
import { toast } from 'sonner';

type RegisterFormValues = { firstName: string; lastName: string; email: string; password?: string };
type RegisterMethod = 'otp' | 'password';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [method, setMethod] = useState<RegisterMethod>('otp');
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaResetKey, setRecaptchaResetKey] = useState(0);
  const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

  const registerSchema = z.object({
    firstName: z.string().min(2, t('auth.validation.firstNameMin')),
    lastName: z.string().min(2, t('auth.validation.lastNameMin')),
    email: z.string().email(t('auth.validation.emailInvalid')),
    password: z.string().optional(),
  });
  const { register, handleSubmit, setError: setFieldError, clearErrors, formState: { errors } } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const resetCaptcha = () => {
    setRecaptchaToken(null);
    setRecaptchaResetKey((key) => key + 1);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    if (method === 'password' && (!data.password || data.password.length < 6)) {
      setFieldError('password', { message: t('auth.validation.passwordMin') });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (method === 'otp') {
        await authService.registerWithOtp({ email: data.email, firstName: data.firstName, lastName: data.lastName });
        setSentEmail(data.email);
        toast.success(t('auth.otp.sent'));
      } else {
        await authService.register({ email: data.email, firstName: data.firstName, lastName: data.lastName, password: data.password });
        router.push('/login');
      }
    } catch (requestError) {
      setError(resolveApiErrorMessage(requestError, t('auth.validation.generic')));
    } finally {
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

  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-900 p-12 md:flex md:w-1/2">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-orange-600/20 to-zinc-900/0" />
        <div className="relative z-10"><div className="mb-8"><Image src={RUNMEAL_LOGO} alt="Runmeal" width={160} height={40} className="h-10 w-auto rounded-lg bg-white px-3 py-2" priority /></div><h2 className="max-w-lg text-4xl font-bold leading-tight text-white">{t('auth.register.heroTitle')}</h2></div>
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
              <div className="text-center md:text-left"><div className="mb-6 flex justify-center md:hidden"><ChefHat className="h-10 w-10 text-orange-600" /></div><h1 className="text-3xl font-bold tracking-tight text-zinc-900">{t('auth.register.title')}</h1><p className="mt-2 text-zinc-500">{t('auth.register.subtitle')}</p></div>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-500">{error}</div>}
                <div className="grid grid-cols-2 gap-4"><Input label={t('auth.register.firstName')} autoComplete="given-name" placeholder={t('auth.register.firstNamePlaceholder')} className="text-zinc-900" error={errors.firstName?.message} {...register('firstName')} /><Input label={t('auth.register.lastName')} autoComplete="family-name" placeholder={t('auth.register.lastNamePlaceholder')} className="text-zinc-900" error={errors.lastName?.message} {...register('lastName')} /></div>
                <Input label={t('auth.email')} type="email" autoComplete="email" placeholder={t('auth.emailPlaceholder')} className="text-zinc-900" error={errors.email?.message} {...register('email')} />
                {method === 'password' && <Input label={t('auth.password')} type="password" autoComplete="new-password" placeholder="••••••••" className="text-zinc-900" error={errors.password?.message} {...register('password')} />}
                <Button type="submit" className="w-full" isLoading={isLoading} size="lg">{method === 'otp' ? t('auth.otp.sendCode') : t('auth.register.submit')}</Button>
                <button type="button" onClick={() => { setMethod(method === 'otp' ? 'password' : 'otp'); clearErrors(); setError(null); }} className="w-full text-sm font-medium text-orange-600 hover:text-orange-500">{method === 'otp' ? t('auth.otp.usePassword') : t('auth.otp.useCode')}</button>
              </form>
              <p className="text-center text-sm text-zinc-600">{t('auth.register.haveAccount')} <Link href="/login" className="font-medium text-orange-600 hover:text-orange-500 hover:underline">{t('auth.register.signIn')}</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
