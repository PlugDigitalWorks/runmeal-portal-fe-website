'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import Image from 'next/image';
import { ChefHat } from 'lucide-react';
import { RUNMEAL_LOGO } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/auth.service';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { RecaptchaWidget } from '@/components/auth/RecaptchaWidget';

type LoginFormValues = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const loginSchema = z.object({
    email: z.string().email(t('auth.validation.emailInvalid')),
    password: z.string().min(1, t('auth.validation.passwordRequired')),
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaResetKey, setRecaptchaResetKey] = useState(0);
  const isRecaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
  const handledGoogleCallbackRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    if (isRecaptchaEnabled && !recaptchaToken) {
      setError(t('auth.validation.securityCheck'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await authService.login({ ...data, recaptchaToken: recaptchaToken ?? undefined });
      router.push('/'); 
      router.refresh(); // Ensure server components re-render if any (not using server components for auth dependent rendering yet, but good practice)
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      setRecaptchaToken(null);
      setRecaptchaResetKey((key) => key + 1);
      setError(
        error.response?.data?.message || t('auth.login.invalidCredentials')
      );
    } finally {
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
        .then(() => {
          router.push('/');
          router.refresh();
        })
        .catch((error) => {
          console.error(error);
          setError(t('auth.login.googleRestoreError'));
        })
        .finally(() => setIsLoading(false));
      return;
    }

    setError(reason || t('auth.login.googleFailed'));
  }, [router, t]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Visual Side (Hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-zinc-900 p-12 flex-col justify-between relative overflow-hidden">
         <div className="absolute inset-0 bg-linear-to-br from-orange-600/20 to-zinc-900/0 pointer-events-none" />
        <div className="relative z-10">
          <div className="mb-8">
            <Image
              src={RUNMEAL_LOGO}
              alt="Runmeal"
              width={160}
              height={40}
              className="h-10 w-auto bg-white rounded-lg px-3 py-2"
              priority
            />
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight max-w-lg">
            {t('auth.login.heroTitle')}
          </h2>
        </div>
         <div className="relative z-10 text-zinc-400 text-sm">
          {t('auth.footer')}
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-8">
           <div className="text-center md:text-left">
             <div className="md:hidden flex justify-center mb-6">
                <ChefHat className="h-10 w-10 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{t('auth.login.title')}</h1>
            <p className="text-zinc-500 mt-2">{t('auth.login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <GoogleAuthButton
              disabled={isLoading}
              onError={(message) => setError(message)}
            />

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-zinc-500">
                  {t('auth.login.orEmail')}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg">
                {error}
              </div>
            )}
            
            <Input
              label={t('auth.email')}
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              className="text-zinc-900"
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="space-y-1">
                 <Input
                label={t('auth.password')}
                type="password"
                placeholder="••••••••"
                className="text-zinc-900"
                error={errors.password?.message}
                {...register('password')}
                />
                <div className="flex justify-end">
                    <Link href="/forgot-password" className="text-sm font-medium text-orange-600 hover:text-orange-500 hover:underline">
                    {t('auth.login.forgot')}
                    </Link>
                </div>
            </div>

            <RecaptchaWidget
              onTokenChange={setRecaptchaToken}
              resetKey={recaptchaResetKey}
            />

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              size="lg"
              disabled={isRecaptchaEnabled && !recaptchaToken}
            >
              {t('auth.login.submit')}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-600">
            {t('auth.login.noAccount')}{' '}
            <Link href="/register" className="font-medium text-orange-600 hover:text-orange-500 hover:underline">
              {t('auth.login.createAccount')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
