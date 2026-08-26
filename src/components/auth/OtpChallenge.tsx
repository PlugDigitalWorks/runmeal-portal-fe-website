'use client';

import { ArrowLeft, MailCheck } from 'lucide-react';
import { FormEvent, ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface OtpChallengeProps {
  email: string;
  error: string | null;
  isLoading: boolean;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  resendDisabled?: boolean;
  resendVerification?: ReactNode;
}

export function OtpChallenge({ email, error, isLoading, onVerify, onResend, onBack, resendDisabled, resendVerification }: OtpChallengeProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length === 6) void onVerify(code);
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-3 text-center md:text-left">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 md:mx-0">
          <MailCheck className="h-7 w-7 text-orange-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{t('auth.otp.title')}</h1>
          <p className="mt-2 text-zinc-500">{t('auth.otp.sentTo', { email })}</p>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-500">{error}</div>}

      <div className="space-y-2">
        <label htmlFor="otp-code" className="text-sm font-medium text-zinc-700">{t('auth.otp.code')}</label>
        <input
          id="otp-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          autoFocus
          placeholder={t('auth.otp.placeholder')}
          className="h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-center text-2xl font-semibold tracking-[0.45em] text-zinc-900 outline-none transition-all placeholder:tracking-normal placeholder:text-zinc-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
        />
        <p className="text-xs text-zinc-500">{t('auth.otp.expires')}</p>
      </div>

      <Button type="submit" className="w-full" size="lg" isLoading={isLoading} disabled={code.length !== 6}>
        {isLoading ? t('auth.otp.verifying') : t('auth.otp.verify')}
      </Button>
      {resendVerification}
      <div className="flex items-center justify-between gap-4 text-sm">
        <button type="button" onClick={onBack} disabled={isLoading} className="inline-flex items-center text-zinc-500 hover:text-zinc-800 disabled:opacity-50"><ArrowLeft className="mr-1 h-4 w-4" />{t('auth.otp.changeEmail')}</button>
        <button type="button" onClick={() => void onResend()} disabled={isLoading || resendDisabled} className="font-medium text-orange-600 hover:text-orange-500 disabled:opacity-50">{t('auth.otp.resend')}</button>
      </div>
    </form>
  );
}
