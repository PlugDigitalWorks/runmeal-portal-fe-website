import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { userService } from '@/services/user.service';
import type { Address } from '@/types/address';
import { AddressForm } from './AddressForm';

const stable = vi.hoisted(() => ({ translation: { t: (key: string) => key } }));

vi.mock('react-i18next', () => ({
  useTranslation: () => stable.translation,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/components/ui/LocationPicker', () => ({ LocationPicker: () => null }));
vi.mock('@/components/ui/AddressSelects', () => ({ AddressSelects: () => null }));
vi.mock('@/services/user.service', () => ({
  userService: { createAddress: vi.fn(), updateAddress: vi.fn() },
}));

const saved: Address = {
  id: 'addr-1',
  countryCode: 'TR',
  province: 'İstanbul',
  district: 'Kadıköy',
  phoneE164: '+905551112233',
  postalCode: '34710',
  street: 'Moda Cd.',
  buildingNumber: '5',
  note: 'Zil bozuk',
  latitude: 40.98,
  longitude: 29.02,
  isActive: true,
};

/** Every field label inside `column`, top to bottom. */
const labelsIn = (column: Element) =>
  [...column.querySelectorAll('label')].map((label) => label.textContent?.replace(/\s+/g, ' ').trim());

describe('<AddressForm />', () => {
  beforeEach(() => {
    vi.mocked(userService.updateAddress).mockResolvedValue(saved);
  });

  it('puts postcode and both address lines on the left, phone and note on the right', () => {
    render(<AddressForm onCancel={vi.fn()} onSuccess={vi.fn()} />);

    const columns = screen.getByText('address.postalCode').closest('.grid')!.children;
    expect(columns).toHaveLength(2);
    expect(labelsIn(columns[0])).toEqual([
      'address.postalCode',
      'address.firstLine',
      'address.secondLine (address.optional)',
    ]);
    expect(labelsIn(columns[1])).toEqual(['address.phone', 'address.note (address.optional)']);
  });

  it('opens a saved address with its building number in line 1 and its note', () => {
    render(<AddressForm initialValues={saved} addressId={saved.id} onCancel={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByLabelText('address.firstLine')).toHaveValue('Moda Cd., 5');
    expect(screen.getByLabelText(/address\.note/)).toHaveValue('Zil bozuk');
  });

  it('sends both lines as one street, with the note and without the old number fields', async () => {
    const onSuccess = vi.fn();
    render(<AddressForm initialValues={saved} addressId={saved.id} onCancel={vi.fn()} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('address.secondLine (address.optional)'), { target: { value: 'D: 3' } });
    fireEvent.change(screen.getByLabelText(/address\.note/), { target: { value: 'Kapıda arayın' } });
    fireEvent.click(screen.getByRole('button', { name: /address.updateAddress/ }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const [id, payload] = vi.mocked(userService.updateAddress).mock.calls[0];
    expect(id).toBe('addr-1');
    expect(payload).toEqual({
      countryCode: 'TR',
      province: 'İstanbul',
      district: 'Kadıköy',
      phoneE164: '+905551112233',
      postalCode: '34710',
      street: 'Moda Cd., 5, D: 3',
      buildingNumber: null,
      note: 'Kapıda arayın',
      latitude: 40.98,
      longitude: 29.02,
    });
  });
});
