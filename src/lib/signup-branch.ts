/**
 * The restaurant a visitor is signing up from. The backend records it on a new
 * account and targets notifications by it (and the brand behind it).
 *
 * The portal belongs to no brand, so a branch only means something when the
 * visitor came to sign up from a restaurant's page: its page sets it, the home
 * page clears it. Kept in sessionStorage so it survives the way through the
 * sign-in and sign-up pages.
 */
const STORAGE_KEY = 'runmeal_signup_branch_id';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function setSignupBranchId(branchId: string | null): void {
  try {
    if (branchId && UUID.test(branchId)) sessionStorage.setItem(STORAGE_KEY, branchId);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the account is opened without a branch.
  }
}

export function getSignupBranchId(): string | null {
  try {
    const branchId = typeof window === 'undefined' ? null : sessionStorage.getItem(STORAGE_KEY);
    return branchId && UUID.test(branchId) ? branchId : null;
  } catch {
    return null;
  }
}

/**
 * `x-branch-id` for a sign-up request, or no header at all — never an empty,
 * "null" or "undefined" one. An unknown branch is ignored by the backend.
 */
export function signupBranchHeaders(): Record<string, string> {
  const branchId = getSignupBranchId();
  return branchId ? { 'x-branch-id': branchId } : {};
}
