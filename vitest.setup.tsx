import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type NextImageProps = { src: string; alt: string } & Record<string, unknown>;

/** Props next/image consumes itself — invalid on a bare <img>. */
const NEXT_IMAGE_ONLY_PROPS = new Set([
  'fill',
  'unoptimized',
  'sizes',
  'priority',
  'quality',
  'loader',
  'placeholder',
  'blurDataURL',
]);

// next/image renders a plain <img> in tests so components under test stay framework-agnostic.
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: NextImageProps) => {
    const imgProps = Object.fromEntries(
      Object.entries(props).filter(([key]) => !NEXT_IMAGE_ONLY_PROPS.has(key)),
    );

    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imgProps} src={props.src} alt={props.alt} />;
  },
}));
