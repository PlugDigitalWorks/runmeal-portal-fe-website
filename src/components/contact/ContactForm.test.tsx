import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContactForm } from './ContactForm';
import { contactService } from '@/services/contact.service';

vi.mock('@/services/contact.service', () => ({
  contactService: { createContactRequest: vi.fn() },
}));

const stable = vi.hoisted(() => ({
  translation: { t: (key: string) => key },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => stable.translation,
}));

vi.mock('sonner', () => ({ toast: stable.toast }));

const mockedContactService = vi.mocked(contactService);

const BRANCH_ID = 'branch-1';
const BRAND_ID = 'brand-1';

const renderForm = () =>
  render(<ContactForm branchId={BRANCH_ID} branchName="Kadıköy Şubesi" brandId={BRAND_ID} />);

const typeMessage = (value: string) =>
  fireEvent.change(screen.getByLabelText('contact.messageLabel'), { target: { value } });

const typePhone = (value: string) =>
  fireEvent.change(screen.getByLabelText(/contact.phoneLabel/), { target: { value } });

const submit = () => fireEvent.click(screen.getByRole('button', { name: /contact.submit/ }));

describe('<ContactForm />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedContactService.createContactRequest.mockResolvedValue({ id: 'req-1' } as never);
  });

  it('shows the branch the message goes to', () => {
    renderForm();

    expect(screen.getByText('Kadıköy Şubesi')).toBeInTheDocument();
  });

  it('refuses an empty message and never calls the API', async () => {
    renderForm();

    submit();

    await waitFor(() =>
      expect(screen.getByText('contact.validation.messageRequired')).toBeInTheDocument(),
    );
    expect(mockedContactService.createContactRequest).not.toHaveBeenCalled();
  });

  it('refuses a message of only whitespace', async () => {
    renderForm();

    typeMessage('     ');
    submit();

    await waitFor(() =>
      expect(screen.getByText('contact.validation.messageRequired')).toBeInTheDocument(),
    );
    expect(mockedContactService.createContactRequest).not.toHaveBeenCalled();
  });

  it('refuses a phone that is not in international format', async () => {
    renderForm();

    typeMessage('Merhaba');
    typePhone('05551234567');
    submit();

    await waitFor(() =>
      expect(screen.getByText('contact.validation.phoneFormat')).toBeInTheDocument(),
    );
    expect(mockedContactService.createContactRequest).not.toHaveBeenCalled();
  });

  it('sends the phone when one is given, against the right branch', async () => {
    renderForm();

    typeMessage('Şubeyle iletişime geçmek istiyorum.');
    typePhone('+905551234567');
    submit();

    await waitFor(() =>
      expect(mockedContactService.createContactRequest).toHaveBeenCalledWith(
        BRANCH_ID,
        { message: 'Şubeyle iletişime geçmek istiyorum.', phoneE164: '+905551234567' },
        BRAND_ID,
      ),
    );
  });

  it('omits the phone key entirely when the field is blank', async () => {
    renderForm();

    typeMessage('Telefonsuz mesaj');
    submit();

    await waitFor(() => expect(mockedContactService.createContactRequest).toHaveBeenCalled());
    // Leaving the key out is what makes the backend fall back to the address phone.
    expect(mockedContactService.createContactRequest).toHaveBeenCalledWith(
      BRANCH_ID,
      { message: 'Telefonsuz mesaj' },
      BRAND_ID,
    );
  });

  it('trims the message before sending it', async () => {
    renderForm();

    typeMessage('   boşluklu mesaj   ');
    submit();

    await waitFor(() =>
      expect(mockedContactService.createContactRequest).toHaveBeenCalledWith(
        BRANCH_ID,
        { message: 'boşluklu mesaj' },
        BRAND_ID,
      ),
    );
  });

  it('reports success and clears the form', async () => {
    renderForm();

    typeMessage('Merhaba');
    typePhone('+905551234567');
    submit();

    await waitFor(() => expect(stable.toast.success).toHaveBeenCalledWith('contact.toast.success'));
    expect(screen.getByLabelText('contact.messageLabel')).toHaveValue('');
    expect(screen.getByLabelText(/contact.phoneLabel/)).toHaveValue('');
  });

  it('disables the button while in flight and blocks a second submit', async () => {
    let resolveRequest: (() => void) | undefined;
    mockedContactService.createContactRequest.mockImplementation(
      () => new Promise((resolve) => {
        resolveRequest = () => resolve({ id: 'req-1' } as never);
      }),
    );

    renderForm();
    typeMessage('Merhaba');
    submit();

    const button = screen.getByRole('button', { name: /contact.submitting/ });
    await waitFor(() => expect(button).toBeDisabled());

    fireEvent.click(button);
    expect(mockedContactService.createContactRequest).toHaveBeenCalledTimes(1);

    resolveRequest?.();
    await waitFor(() => expect(stable.toast.success).toHaveBeenCalled());
  });

  it('surfaces the backend message and keeps what the user wrote', async () => {
    mockedContactService.createContactRequest.mockRejectedValue({
      response: { status: 400, data: { message: 'User contact identity is incomplete' } },
    });

    renderForm();
    typeMessage('Merhaba');
    submit();

    await waitFor(() =>
      expect(stable.toast.error).toHaveBeenCalledWith('User contact identity is incomplete'),
    );
    expect(screen.getByLabelText('contact.messageLabel')).toHaveValue('Merhaba');
  });

  it('falls back to generic copy when the error carries no message', async () => {
    mockedContactService.createContactRequest.mockRejectedValue(new Error('network'));

    renderForm();
    typeMessage('Merhaba');
    submit();

    await waitFor(() => expect(stable.toast.error).toHaveBeenCalledWith('contact.toast.failed'));
  });
});
