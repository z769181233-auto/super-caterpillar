import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  forwardSetCookies,
  readEnvValueFromFiles,
  resolveProxyEnv,
} from './novel-import-proxy';

test('forwardSetCookies appends every cookie from getSetCookie()', () => {
  const source = new Headers() as Headers & { getSetCookie?: () => string[] };
  source.getSetCookie = () => [
    'accessToken=token-a; Path=/; HttpOnly',
    'refreshToken=token-b; Path=/; HttpOnly',
  ];

  const target = new Headers();
  forwardSetCookies(source, target);

  assert.deepEqual(target.getSetCookie(), [
    'accessToken=token-a; Path=/; HttpOnly',
    'refreshToken=token-b; Path=/; HttpOnly',
  ]);
});

test('forwardSetCookies falls back to a single set-cookie header when getSetCookie is unavailable', () => {
  const source = new Headers();
  source.append('set-cookie', 'accessToken=token-a; Path=/; HttpOnly');

  const target = new Headers();
  forwardSetCookies(source, target);

  assert.deepEqual(target.getSetCookie(), ['accessToken=token-a; Path=/; HttpOnly']);
});

test('readEnvValueFromFiles loads proxy env secrets from fallback env files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-proxy-env-'));
  const rootEnv = path.join(dir, '.env');
  const apiEnv = path.join(dir, 'apps-api.env');
  const envName = `NOVEL_PROXY_TEST_ENV_${Date.now()}`;

  fs.writeFileSync(rootEnv, `${envName}=root-value\n`, 'utf8');
  fs.writeFileSync(apiEnv, `${envName}_API=api-value\n`, 'utf8');

  assert.equal(readEnvValueFromFiles(envName, [rootEnv, apiEnv]), 'root-value');
  assert.equal(readEnvValueFromFiles(`${envName}_API`, [rootEnv, apiEnv]), 'api-value');
});

test('resolveProxyEnv prefers process env over fallback files', () => {
  const envName = `NOVEL_PROXY_RUNTIME_ENV_${Date.now()}`;
  process.env[envName] = 'runtime-value';

  try {
    assert.equal(resolveProxyEnv(envName), 'runtime-value');
  } finally {
    delete process.env[envName];
  }
});

test('readEnvValueFromFiles default lookup walks up from apps/web cwd to workspace env files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-proxy-cwd-'));
  const originalCwd = process.cwd();
  const webDir = path.join(dir, 'apps/web');
  const apiDir = path.join(dir, 'apps/api');
  const envName = `NOVEL_PROXY_DEFAULT_ENV_${Date.now()}`;
  const apiEnvName = `${envName}_API`;

  fs.mkdirSync(webDir, { recursive: true });
  fs.mkdirSync(apiDir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.env'), `${envName}=workspace-root\n`, 'utf8');
  fs.writeFileSync(path.join(apiDir, '.env'), `${apiEnvName}=api-secret\n`, 'utf8');

  process.chdir(webDir);

  try {
    assert.equal(readEnvValueFromFiles(envName), 'workspace-root');
    assert.equal(readEnvValueFromFiles(apiEnvName), 'api-secret');
  } finally {
    process.chdir(originalCwd);
  }
});
