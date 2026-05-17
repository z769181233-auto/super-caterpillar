import { getSafeRedirect } from '@/lib/nav/safeRedirect';
import type { AuthMode } from '@/features/auth/auth-mode-meta';

interface AuthFormParams {
  locale: string;
  fromParam?: string | null;
  email?: string | null;
}

export type AuthFailureReason =
  | 'invalid'
  | 'email_exists'
  | 'invalid_form'
  | 'invalid_email'
  | 'invalid_password'
  | 'network';

export function buildAuthSubmitAction({
  mode,
  locale,
  fromParam,
  email: _email,
}: AuthFormParams & { mode: AuthMode }): string {
  const params = new URLSearchParams({ locale });

  if (fromParam) {
    params.set('from', fromParam);
  }

  return `/api/auth/${mode}/?${params.toString()}`;
}

export function buildAuthSuccessLocation({
  mode,
  locale,
  fromParam,
  email,
}: AuthFormParams & { mode: AuthMode }): string {
  if (mode === 'login') {
    return getSafeRedirect(fromParam, locale, `/${locale}/projects`);
  }

  const params = new URLSearchParams({ registered: '1' });
  if (fromParam) {
    params.set('from', fromParam);
  }
  if (email) {
    params.set('email', email);
  }

  return `/${locale}/login?${params.toString()}`;
}

export function buildAuthFailureLocation({
  mode,
  locale,
  fromParam,
  email,
  reason = 'invalid',
}: AuthFormParams & { mode: AuthMode; reason?: AuthFailureReason }): string {
  const params = new URLSearchParams({ error: reason });
  if (fromParam) {
    params.set('from', fromParam);
  }
  if (email) {
    params.set('email', email);
  }

  return `/${locale}/${mode}?${params.toString()}`;
}

export function parseAuthFailureReason(
  status: number,
  bodyText: string,
  mode: AuthMode
): AuthFailureReason {
  const raw = bodyText.trim();
  let message = raw;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as
        | { message?: string | string[]; error?: { message?: string | string[] } }
        | null;
      const candidate = parsed?.message ?? parsed?.error?.message ?? raw;
      message = Array.isArray(candidate) ? candidate.join(' ') : String(candidate);
    } catch {
      message = raw;
    }
  }

  const normalized = message.toLowerCase();

  if (status === 409 || normalized.includes('already exists')) {
    return 'email_exists';
  }

  if (normalized.includes('email must be an email')) {
    return 'invalid_email';
  }

  if (
    normalized.includes('password must be longer than or equal') ||
    normalized.includes('password should not be empty')
  ) {
    return 'invalid_password';
  }

  if (
    status === 400 ||
    normalized.includes('bad request')
  ) {
    return 'invalid_form';
  }

  if (status === 401 || normalized.includes('invalid credential')) {
    return 'invalid';
  }

  if (status >= 500) {
    return 'network';
  }

  return mode === 'register' ? 'invalid_form' : 'invalid';
}

export function isHtmlFormSubmission(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }

  return (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  );
}
