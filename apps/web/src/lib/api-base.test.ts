import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApiUrl, resolveApiOrigin } from './api-base';

const API_ENV_KEYS = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_API_BASE_URL',
  'API_BASE_URL',
  'API_URL',
];

function withoutApiEnv(run: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const key of API_ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  try {
    run();
  } finally {
    for (const key of API_ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('resolveApiOrigin falls back to local api origin on the server runtime', () => {
  withoutApiEnv(() => {
    assert.equal(resolveApiOrigin(), 'http://127.0.0.1:3000');
    assert.equal(buildApiUrl('/api/projects'), 'http://127.0.0.1:3000/api/projects');
  });
});

test('resolveApiOrigin normalizes explicit api base values', () => {
  withoutApiEnv(() => {
    process.env.API_BASE_URL = 'http://127.0.0.1:3101/api/';

    assert.equal(resolveApiOrigin(), 'http://127.0.0.1:3101');
    assert.equal(buildApiUrl('api/projects'), 'http://127.0.0.1:3101/api/projects');
  });
});
