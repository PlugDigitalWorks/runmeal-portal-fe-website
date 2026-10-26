import { roundCoordinates, type Coordinates } from '@/lib/geo';

/**
 * The visitor's answer to "share your location", for this browser session:
 * once they decline (or the browser cannot tell) they are not asked again.
 * Only the rounded position is kept.
 */
export type BrowserLocationState =
  | { status: 'unknown' }
  | { status: 'prompting' }
  | { status: 'granted'; coords: Coordinates }
  | { status: 'denied' };

const STORAGE_KEY = 'runmeal_browser_location';
const UNKNOWN: BrowserLocationState = { status: 'unknown' };

let current: BrowserLocationState | null = null;
const listeners = new Set<() => void>();

function read(): BrowserLocationState {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (stored?.status === 'denied') return { status: 'denied' };
    if (stored?.status === 'granted' && Number.isFinite(stored.coords?.lat) && Number.isFinite(stored.coords?.lng)) {
      return { status: 'granted', coords: roundCoordinates(stored.coords) };
    }
  } catch {
    // Storage blocked or unreadable: ask as on a first visit.
  }
  return UNKNOWN;
}

function write(next: BrowserLocationState) {
  current = next;
  try {
    // A prompt left open by a reload is asked again, so it is not stored.
    if (next.status === 'granted' || next.status === 'denied') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Storage blocked: the answer lasts until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

export const browserLocationStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): BrowserLocationState {
    current ??= read();
    return current;
  },
  getServerSnapshot(): BrowserLocationState {
    return UNKNOWN;
  },

  /** Asks the browser once; a refusal, an error or no support counts as declined. */
  request() {
    const state = browserLocationStore.getSnapshot();
    if (state.status === 'prompting' || state.status === 'granted') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      write({ status: 'denied' });
      return;
    }
    write({ status: 'prompting' });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        write({
          status: 'granted',
          coords: roundCoordinates({ lat: position.coords.latitude, lng: position.coords.longitude }),
        }),
      () => write({ status: 'denied' }),
      { maximumAge: 10 * 60 * 1000, timeout: 15 * 1000 },
    );
  },

  decline() {
    write({ status: 'denied' });
  },

  /** Test hook: forget the session's answer. */
  reset() {
    current = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing stored.
    }
    listeners.forEach((listener) => listener());
  },
};
