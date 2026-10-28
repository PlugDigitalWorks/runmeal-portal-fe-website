import i18n from '@/i18n/config';

interface ApiErrorLike {
  response?: { data?: { code?: unknown; message?: unknown; data?: unknown } };
}

/** The envelope's `code` (e.g. `VALIDATION_FAILED`), when the API sent one. */
export function getApiErrorCode(error: unknown): string | null {
  const code = (error as ApiErrorLike)?.response?.data?.code;
  return typeof code === 'string' ? code : null;
}

export function resolveApiErrorMessage(error: unknown, fallback: string): string {
  const envelope = (error as ApiErrorLike)?.response?.data;
  const code = getApiErrorCode(error);
  if (code) {
    const key = `apiErrors.${code}`;
    if (i18n.exists(key)) {
      const values = envelope?.data && typeof envelope.data === 'object' ? envelope.data : {};
      return i18n.t(key, values as Record<string, unknown>);
    }
  }
  return typeof envelope?.message === 'string' && envelope.message.trim() ? envelope.message : fallback;
}
