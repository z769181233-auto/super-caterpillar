import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuthFailureLocation,
  buildAuthSubmitAction,
  buildAuthSuccessLocation,
  isHtmlFormSubmission,
  parseAuthFailureReason,
} from './auth-form-flow';

test('buildAuthSubmitAction preserves locale and from param', () => {
  assert.equal(
    buildAuthSubmitAction({
      mode: 'register',
      locale: 'zh',
      fromParam: '/zh/projects',
    }),
    '/api/auth/register/?locale=zh&from=%2Fzh%2Fprojects'
  );
});

test('buildAuthSuccessLocation routes register success to localized login page', () => {
  assert.equal(
    buildAuthSuccessLocation({
      mode: 'register',
      locale: 'zh',
      fromParam: '/zh/projects/demo/import-novel',
      email: 'engineer@super-caterpillar.com',
    }),
    '/zh/login?registered=1&from=%2Fzh%2Fprojects%2Fdemo%2Fimport-novel&email=engineer%40super-caterpillar.com'
  );
});

test('buildAuthFailureLocation routes back to localized auth page', () => {
  assert.equal(
    buildAuthFailureLocation({
      mode: 'login',
      locale: 'zh',
      fromParam: '/zh/projects',
      email: 'engineer@super-caterpillar.com',
    }),
    '/zh/login?error=invalid&from=%2Fzh%2Fprojects&email=engineer%40super-caterpillar.com'
  );
});

test('buildAuthFailureLocation preserves explicit error reasons', () => {
  assert.equal(
    buildAuthFailureLocation({
      mode: 'register',
      locale: 'zh',
      reason: 'email_exists',
    }),
    '/zh/register?error=email_exists'
  );
});

test('parseAuthFailureReason recognizes duplicate-email and validation failures', () => {
  assert.equal(parseAuthFailureReason(409, '{"message":"Email already exists"}', 'register'), 'email_exists');
  assert.equal(
    parseAuthFailureReason(
      400,
      '{"message":["email must be an email","password must be longer than or equal to 6 characters"]}',
      'register'
    ),
    'invalid_email'
  );
  assert.equal(
    parseAuthFailureReason(
      400,
      '{"message":["password must be longer than or equal to 6 characters"]}',
      'login'
    ),
    'invalid_password'
  );
});

test('isHtmlFormSubmission detects urlencoded and multipart forms', () => {
  assert.equal(isHtmlFormSubmission('application/x-www-form-urlencoded'), true);
  assert.equal(isHtmlFormSubmission('multipart/form-data; boundary=abc'), true);
  assert.equal(isHtmlFormSubmission('application/json'), false);
});
