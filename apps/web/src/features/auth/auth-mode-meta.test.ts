import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthErrorMessageKey, getAuthModeMeta, getAuthSuccessRedirect } from './auth-mode-meta';

test('getAuthModeMeta points login users to register while preserving from', () => {
  const meta = getAuthModeMeta({
    mode: 'login',
    locale: 'zh',
    fromParam: '/zh/projects',
  });

  assert.equal(meta.switchHref, '/zh/register?from=%2Fzh%2Fprojects');
  assert.equal(meta.promptKey, 'switchToRegisterPrompt');
  assert.equal(meta.actionKey, 'switchToRegisterAction');
  assert.equal(meta.submitEndpoint, '/api/auth/login/');
  assert.equal(meta.formAction, '/api/auth/login/?locale=zh&from=%2Fzh%2Fprojects');
});

test('getAuthModeMeta points register users back to login without query when from is absent', () => {
  const meta = getAuthModeMeta({
    mode: 'register',
    locale: 'zh',
  });

  assert.equal(meta.switchHref, '/zh/login');
  assert.equal(meta.promptKey, 'switchToLoginPrompt');
  assert.equal(meta.actionKey, 'switchToLoginAction');
  assert.equal(meta.submitEndpoint, '/api/auth/register/');
  assert.equal(meta.formAction, '/api/auth/register/?locale=zh');
});

test('getAuthSuccessRedirect sends register users to login with registered marker', () => {
  const redirect = getAuthSuccessRedirect({
    mode: 'register',
    locale: 'zh',
    fromParam: '/zh/projects',
  });

  assert.equal(redirect, '/zh/login?registered=1&from=%2Fzh%2Fprojects');
});

test('getAuthSuccessRedirect sends login users to workspace fallback', () => {
  const redirect = getAuthSuccessRedirect({
    mode: 'login',
    locale: 'zh',
  });

  assert.equal(redirect, '/zh/projects');
});

test('getAuthErrorMessageKey maps known error codes to specific translation keys', () => {
  assert.equal(getAuthErrorMessageKey('email_exists'), 'errorEmailExists');
  assert.equal(getAuthErrorMessageKey('invalid_email'), 'errorInvalidEmail');
  assert.equal(getAuthErrorMessageKey('invalid_password'), 'errorInvalidPassword');
  assert.equal(getAuthErrorMessageKey('invalid_form'), 'errorInvalidForm');
  assert.equal(getAuthErrorMessageKey('network'), 'errorNetwork');
  assert.equal(getAuthErrorMessageKey('invalid'), 'errorInvalid');
  assert.equal(getAuthErrorMessageKey('unknown'), 'errorInvalid');
});
