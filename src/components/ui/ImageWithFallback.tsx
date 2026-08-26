'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';

import { DEFAULT_PRODUCT_IMAGE } from '@/lib/constants';
import { cn } from '@/lib/utils';

type ImageWithFallbackProps = Omit<ImageProps, 'src' | 'onError'> & {
  src?: string | null;
  fallbackSrc?: string;
  fallbackClassName?: string;
};
export function ImageWithFallback({
  src,
  alt,
  className,
  fallbackSrc = DEFAULT_PRODUCT_IMAGE,
  fallbackClassName = 'object-contain p-4 opacity-40',
  ...props
}: ImageWithFallbackProps) {
  const [hasFailed, setHasFailed] = useState(false);

  const trimmed = typeof src === 'string' ? src.trim() : '';
  const isFallback = hasFailed || !trimmed;
  const resolvedSrc = isFallback ? fallbackSrc : trimmed;

  return (
    <Image
      {...props}
      key={resolvedSrc}
      src={resolvedSrc}
      alt={alt}
      className={cn(className, isFallback && fallbackClassName)}
      onError={() => setHasFailed(true)}
    />
  );
}
