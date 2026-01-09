type UnauthorizedLike = { status?: number; code?: string; message?: string };

export function maybeRedirectUnauthorized(err: unknown): boolean {
  const e = err as UnauthorizedLike;
  const unauthorized =
    e?.status === 401 ||
    e?.code === 'UNAUTHORIZED' ||
    String(e?.message || '').includes('Unauthorized');

  if (!unauthorized) return false;

  if (typeof window !== 'undefined' && typeof globalThis.__scu_onUnauthorized === 'function') {
    globalThis.__scu_onUnauthorized();
  }
  return true;
}
