import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'bg-orange-600 text-white hover:bg-orange-700 shadow-md hover:shadow-lg',
      secondary: 'bg-zinc-800 text-white hover:bg-zinc-700',
      outline: 'border-2 border-zinc-200 bg-transparent hover:bg-zinc-100 text-zinc-900',
      ghost: 'bg-transparent hover:bg-zinc-100 text-zinc-700',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    };

    const sizes = {
      sm: 'h-9 px-3 text-sm rounded-md',
      md: 'h-11 px-6 text-base rounded-lg',
      lg: 'h-14 px-8 text-lg rounded-xl',
      icon: 'h-10 w-10 p-0',
    };

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          isLoading && 'cursor-wait opacity-80',
          className
        )}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
