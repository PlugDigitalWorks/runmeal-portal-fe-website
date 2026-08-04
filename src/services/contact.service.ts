import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import { ContactRequest, CreateContactRequestDto } from '@/types/contact';

export const contactService = {
  /**
   * Sends a contact request to a branch. The branch id travels twice on purpose:
   * the path picks the record, the `x-branch-id` header satisfies the API's
   * brand/branch guard. `x-brand-id` is not set globally in this app, so it is
   * passed explicitly whenever the caller knows it.
   */
  async createContactRequest(branchId: string, dto: CreateContactRequestDto, brandId?: string) {
    const headers: Record<string, string> = { 'x-branch-id': branchId };
    if (brandId) {
      headers['x-brand-id'] = brandId;
    }

    const response = await api.post<ApiResponse<ContactRequest>>(
      `/contact-requests/branches/${branchId}`,
      dto,
      { headers }
    );
    return response.data.data;
  }
};
