'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { authService } from '@/services/auth.service';

interface GoogleAuthButtonProps {
  disabled?: boolean;
  onError?: (message: string) => void;
}

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message;
  }

  return undefined;
};

export function GoogleAuthButton({ disabled, onError }: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const response = await authService.startGoogleLogin();
      window.location.assign(response.redirectUrl);
    } catch (error) {
      console.error(error);
      onError?.(getErrorMessage(error) || 'Google login could not be started.');
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 shadow-sm transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 text-sm font-bold text-zinc-700">
          G
        </span>
      )}
      {isLoading ? 'Redirecting...' : 'Continue with Google'}
    </button>
  );
}
