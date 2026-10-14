import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OtpChallenge } from './OtpChallenge';
import { getRecaptchaSiteKey } from '@/lib/recaptcha';

const stable = vi.hoisted(() => ({
  translation: { t: (key: string) => key },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => stable.translation,
}));

vi.mock('@/lib/recaptcha', () => ({ getRecaptchaSiteKey: vi.fn() }));

// Stands in for Google's widget: a button that "solves" the check.
vi.mock('./RecaptchaWidget', () => ({
  RecaptchaWidget: ({ onTokenChange }: { onTokenChange: (token: string | null) => void }) => (
    <button type="button" onClick={() => onTokenChange('captcha-token')}>solve-captcha</button>
  ),
}));

const mockedSiteKey = vi.mocked(getRecaptchaSiteKey);

const renderChallenge = (onResend = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <OtpChallenge
      email="user@example.com"
      error={null}
      isLoading={false}
      onVerify={vi.fn().mockResolvedValue(undefined)}
      onResend={onResend}
      onBack={vi.fn()}
    />,
  );
  return onResend;
};

const resendButton = () => screen.getByRole('button', { name: 'auth.otp.resend' });

describe('<OtpChallenge />', () => {
  beforeEach(() => {
    mockedSiteKey.mockReturnValue('site-key');
  });

  it('keeps the security check hidden until resend is asked for', () => {
    renderChallenge();

    expect(screen.queryByText('solve-captcha')).not.toBeInTheDocument();
    expect(resendButton()).toBeEnabled();
  });

  it('shows the check on resend and sends the code once it is solved', () => {
    const onResend = renderChallenge();

    fireEvent.click(resendButton());

    expect(onResend).not.toHaveBeenCalled();
    expect(screen.getByText('auth.otp.resendCheck')).toBeInTheDocument();
    expect(resendButton()).toBeDisabled();

    fireEvent.click(screen.getByText('solve-captcha'));

    expect(onResend).toHaveBeenCalledExactlyOnceWith('captcha-token');
    expect(screen.queryByText('solve-captcha')).not.toBeInTheDocument();
    expect(resendButton()).toBeEnabled();
  });

  it('resends straight away when reCAPTCHA is not configured', () => {
    mockedSiteKey.mockReturnValue(undefined);
    const onResend = renderChallenge();

    fireEvent.click(resendButton());

    expect(onResend).toHaveBeenCalledExactlyOnceWith();
    expect(screen.queryByText('solve-captcha')).not.toBeInTheDocument();
  });
});
