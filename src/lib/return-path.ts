/**
 * Where to send a visitor after signing in. Browsing never needs an account;
 * the basket and checkout do, and the visitor comes back to the page they
 * left. Kept in sessionStorage so it survives the Google sign-in round trip.
 */
const RETURN_PATH_KEY = 'runmeal_return_path';

/** Same-origin paths only: "/x" but never "//host" or "https://…". */
const isSafePath = (path: string | null | undefined): path is string =>
  !!path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/login') && !path.startsWith('/register');

export function rememberReturnPath(path?: string) {
  if (typeof window === 'undefined') return;
  const target = path ?? `${window.location.pathname}${window.location.search}`;
  if (!isSafePath(target)) return;
  try {
    sessionStorage.setItem(RETURN_PATH_KEY, target);
  } catch {
    // Storage blocked: the visitor lands on the home page instead.
  }
}

/** The remembered path (forgotten once read), or the home page. */
export function takeReturnPath(): string {
  if (typeof window === 'undefined') return '/';
  try {
    const path = sessionStorage.getItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(RETURN_PATH_KEY);
    return isSafePath(path) ? path : '/';
  } catch {
    return '/';
  }
}
