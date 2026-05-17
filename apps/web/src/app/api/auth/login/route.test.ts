import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from './route';

test('login route returns structured JSON when upstream auth service is unavailable', async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:3000');
  }) as typeof fetch;

  try {
    const request = new NextRequest(
      'http://127.0.0.1:3101/api/auth/login/?locale=zh&from=%2Fzh%2Fprojects',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'adam.z@test.com', password: 'secret123' }),
      }
    );

    const response = await POST(request);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      success: false,
      message: 'Authentication service unavailable',
    });
  } finally {
    global.fetch = originalFetch;
  }
});
