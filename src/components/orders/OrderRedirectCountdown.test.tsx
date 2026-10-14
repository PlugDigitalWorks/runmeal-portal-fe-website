import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrderRedirectCountdown } from './OrderRedirectCountdown';

const stable = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  translation: {
    t: (key: string, options?: { seconds?: number }) =>
      options?.seconds === undefined ? key : `${key}:${options.seconds}`,
  },
}));

vi.mock('next/navigation', () => ({ useRouter: () => stable.router }));
vi.mock('react-i18next', () => ({ useTranslation: () => stable.translation }));

describe('<OrderRedirectCountdown />', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down and replaces the page with the order after five seconds', () => {
    render(<OrderRedirectCountdown href="/orders/order-1" />);

    expect(screen.getByText('payment.redirectingToOrder:5')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('payment.redirectingToOrder:3')).toBeInTheDocument();
    expect(stable.router.replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(3000));
    expect(stable.router.replace).toHaveBeenCalledExactlyOnceWith('/orders/order-1');
  });

  it('lands on the latest href without restarting the countdown', () => {
    const { rerender } = render(<OrderRedirectCountdown href="/orders/order-1" />);

    act(() => vi.advanceTimersByTime(3000));
    rerender(<OrderRedirectCountdown href="/orders/order-1?branchId=b-1" />);
    act(() => vi.advanceTimersByTime(2000));

    expect(stable.router.replace).toHaveBeenCalledExactlyOnceWith('/orders/order-1?branchId=b-1');
  });

  it('does not redirect once unmounted', () => {
    const { unmount } = render(<OrderRedirectCountdown href="/orders/order-1" />);

    act(() => vi.advanceTimersByTime(1000));
    unmount();
    act(() => vi.advanceTimersByTime(10000));

    expect(stable.router.replace).not.toHaveBeenCalled();
  });
});
