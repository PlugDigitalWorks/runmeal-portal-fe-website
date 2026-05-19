'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AxiosError } from 'axios';
import { ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authService } from '@/services/auth.service';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.login(data);
      router.push('/'); 
      router.refresh(); // Ensure server components re-render if any (not using server components for auth dependent rendering yet, but good practice)
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      setError(
        error.response?.data?.message || 'Invalid email or password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

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
            Welcome back! We missed you.
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
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Sign in</h1>
            <p className="text-zinc-500 mt-2">Access your account to order.</p>
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

            <div className="space-y-1">
                 <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                className="text-zinc-900"
                error={errors.password?.message}
                {...register('password')}
                />
                <div className="flex justify-end">
                    <Link href="/forgot-password" className="text-sm font-medium text-orange-600 hover:text-orange-500 hover:underline">
                    Forgot password?
                    </Link>
                </div>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading} size="lg">
              Sign In
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-600">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-orange-600 hover:text-orange-500 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
