'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/auth.service';
import { AxiosError } from 'axios';
import { ApiResponse } from '@/types/auth';

const registerSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.register(data);
      setSuccess(true);
      // Optional: Auto login or redirect to verification notice
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      const error = err as AxiosError<ApiResponse<unknown>>;
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
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
             <ChefHat className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">Account Created!</h1>
          <p className="text-zinc-600">
            Your account has been successfully created. Please check your email to verify your account before logging in.
          </p>
          <div className="pt-4">
            <Link 
              href="/login" 
              className="inline-flex h-10 items-center justify-center rounded-md bg-orange-600 px-8 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Visual Side (Hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-zinc-900 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-orange-600/20 to-zinc-900/0 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white mb-8">
            <ChefHat className="h-8 w-8 text-orange-500" />
            <span className="text-2xl font-bold">FoodDelivery</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight max-w-lg">
            Delicious food delivered to your doorstep.
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
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Create an account</h1>
            <p className="text-zinc-500 mt-2">Enter your details to get started.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg">
                {error}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="John"
                className="text-zinc-900"
                error={errors.firstName?.message}
                {...register('firstName')}
              />
              <Input
                label="Last Name"
                placeholder="Doe"
                className="text-zinc-900"
                error={errors.lastName?.message}
                {...register('lastName')}
              />
            </div>

            <Input
              label="Email"
              type="email"
              placeholder="name@example.com"
              className="text-zinc-900"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              className="text-zinc-900"
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" className="w-full" isLoading={isLoading} size="lg">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-orange-600 hover:text-orange-500 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
