'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { ApiResponse } from '@/types/auth';

type ResetPasswordFormValues = {
  password: string;
  confirmPassword: string;
};

function ResetPasswordForm() {
    const { t } = useTranslation();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const resetPasswordSchema = z
      .object({
        password: z.string().min(6, t('auth.validation.passwordMin')),
        confirmPassword: z.string().min(6, t('auth.validation.passwordMin')),
      })
      .refine((data) => data.password === data.confirmPassword, {
        message: t('auth.validation.passwordsMatch'),
        path: ['confirmPassword'],
      });

    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
  
    const {
      register,
      handleSubmit,
      formState: { errors },
    } = useForm<ResetPasswordFormValues>({
      resolver: zodResolver(resetPasswordSchema),
    });
  
    const onSubmit = async (data: ResetPasswordFormValues) => {
      if (!token) {
          setError(t('auth.reset.missingToken'));
          return;
      }

      setIsLoading(true);
      setError(null);
      try {
        await authService.resetPassword({
            token,
            password: data.password
        });
        setSuccess(true);
      } catch (err) {
        const error = err as AxiosError<ApiResponse<{ message: string }>>;
        setError(
          error.response?.data?.message || t('auth.validation.generic')
        );
      } finally {
        setIsLoading(false);
      }
    };
  
    if (success) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
          <div className="w-full max-w-md text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
               <ChefHat className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">{t('auth.reset.successTitle')}</h1>
            <p className="text-zinc-600">
              {t('auth.reset.successText')}
            </p>
            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-md bg-orange-600 px-8 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {t('auth.reset.goToLogin')}
              </Link>
            </div>
          </div>
        </div>
      );
    }

    if (!token) {
         return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
          <div className="w-full max-w-md text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
               <ChefHat className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">{t('auth.reset.invalidTitle')}</h1>
            <p className="text-zinc-600">
              {t('auth.reset.invalidText')}
            </p>
            <div className="pt-4">
              <Link
                href="/forgot-password"
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-8 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {t('auth.reset.requestAgain')}
              </Link>
            </div>
          </div>
        </div>
      );
    }
  
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-white">
        {/* Visual Side */}
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
              {t('auth.reset.heroTitle')}
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
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{t('auth.reset.title')}</h1>
              <p className="text-zinc-500 mt-2">{t('auth.reset.subtitle')}</p>
            </div>
  
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg">
                  {error}
                </div>
              )}
              
              <Input
                label={t('auth.reset.newPassword')}
                type="password"
                placeholder="••••••••"
                className="text-zinc-900"
                error={errors.password?.message}
                {...register('password')}
              />

              <Input
                label={t('auth.reset.confirmPassword')}
                type="password"
                placeholder="••••••••"
                className="text-zinc-900"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />

              <Button type="submit" className="w-full" isLoading={isLoading} size="lg">
                {t('auth.reset.submit')}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ResetPasswordForm />
        </Suspense>
    )
}
