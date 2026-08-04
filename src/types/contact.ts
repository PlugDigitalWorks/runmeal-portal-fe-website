/** Longest message the API accepts; the form counts against the same number. */
export const CONTACT_MESSAGE_MAX_LENGTH = 5000;

/**
 * Body of `POST /contact-requests/branches/:branchId`.
 *
 * Name, surname and e-mail are read from the signed-in account server side, so
 * they are never sent from here. Omitting `phoneE164` makes the backend fall
 * back to the user's active address phone, so we never look that up ourselves.
 */
export interface CreateContactRequestDto {
  message: string;
  phoneE164?: string;
}

export interface ContactRequest {
  id: string;
  brandId: string;
  branchId: string;
  senderFirstName: string;
  senderLastName: string;
  senderEmail: string;
  senderPhone: string | null;
  message: string;
  status: string;
  createdAt: string;
}

/** The API rejects a request whose account is missing any of these. */
export const hasCompleteContactIdentity = (
  user: { firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined,
) => Boolean(user?.firstName?.trim() && user?.lastName?.trim() && user?.email?.trim());
