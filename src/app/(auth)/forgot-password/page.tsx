'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AxiosError } from 'axios';
import { ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/auth.service';
import { ApiResponse } from '@/types/auth';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await authService.forgotPassword(data.email);
      setSuccess(response.message || 'If an account exists, a reset link has been sent.');
    } catch (err) {
      const error = err as AxiosError<ApiResponse<{ message: string }>>;
      setError(
        error.response?.data?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
             <ChefHat className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Check Your Email</h1>
          <p className="text-zinc-600">
            {success}
          </p>
          <div className="pt-4">
            <Link 
              href="/login" 
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-8 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              Back to Login
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
          <div className="flex items-center gap-2 text-white mb-8">
             <ChefHat className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold">FoodDelivery</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight max-w-lg">
            Forgot your password? No worries.
          </h2>
        </div>
        <div className="relative z-10 text-zinc-400 text-sm">
          © 2024 FoodDelivery Inc.
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-8">
           <div className="text-center md:text-left">
             <div className="md:hidden flex justify-center mb-6">
                <ChefHat className="h-10 w-10 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Reset Password</h1>
            <p className="text-zinc-500 mt-2">Enter your email to receive a reset link.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg">
                {error}
              </div>
            )}
            
            <Input
              label="Email"
              type="email"
              placeholder="name@example.com"
              className="text-zinc-900"
              error={errors.email?.message}
              {...register('email')}
            />

            <Button type="submit" className="w-full" isLoading={isLoading} size="lg">
              Send Reset Link
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-600">
            Remember your password?{' '}
            <Link href="/login" className="font-medium text-orange-600 hover:text-orange-500 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
