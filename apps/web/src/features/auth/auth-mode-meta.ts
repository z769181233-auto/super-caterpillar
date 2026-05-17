export type AuthMode = 'login' | 'register';

export interface AuthModeMetaInput {
  mode: AuthMode;
  locale: string;
  fromParam?: string | null;
}

export interface AuthModeMeta {
  switchHref: string;
  promptKey: string;
  actionKey: string;
  submitEndpoint: string;
  formAction: string;
}

export function getAuthErrorMessageKey(errorCode: string | null | undefined): string {
  switch (errorCode) {
    case 'email_exists':
      return 'errorEmailExists';
    case 'invalid_email':
      return 'errorInvalidEmail';
    case 'invalid_password':
      return 'errorInvalidPassword';
    case 'invalid_form':
      return 'errorInvalidForm';
    case 'network':
      return 'errorNetwork';
    case 'invalid':
    default:
      return 'errorInvalid';
  }
}

export function getAuthModeMeta({ mode, locale, fromParam }: AuthModeMetaInput): AuthModeMeta {
  const isLogin = mode === 'login';
  const targetPath = `/${locale}/${isLogin ? 'register' : 'login'}`;

  const switchHref = fromParam
    ? `${targetPath}?${new URLSearchParams({ from: fromParam }).toString()}`
    : targetPath;

  return {
    switchHref,
    promptKey: isLogin ? 'switchToRegisterPrompt' : 'switchToLoginPrompt',
    actionKey: isLogin ? 'switchToRegisterAction' : 'switchToLoginAction',
    submitEndpoint: isLogin ? '/api/auth/login/' : '/api/auth/register/',
    formAction: `/api/auth/${mode}/?${new URLSearchParams(
      fromParam ? { locale, from: fromParam } : { locale }
    ).toString()}`,
  };
}

export function getAuthSuccessRedirect({
  mode,
  locale,
  fromParam,
}: AuthModeMetaInput): string {
  if (mode === 'login') {
    return fromParam || `/${locale}/projects`;
  }

  const params = new URLSearchParams({ registered: '1' });
  if (fromParam) {
    params.set('from', fromParam);
  }

  return `/${locale}/login?${params.toString()}`;
}
