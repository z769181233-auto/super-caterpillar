import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';

test('GET /api/projects forwards cookies to backend projects endpoint', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedHeaders: HeadersInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedHeaders = init?.headers;
    return new Response(JSON.stringify({ success: true, data: { projects: [] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const request = new NextRequest('http://127.0.0.1:3101/api/projects/', {
      headers: { cookie: 'accessToken=test-token' },
    });

    const response = await GET(request);
    const body = await response.text();

    assert.equal(capturedUrl.endsWith('/api/projects'), true);
    assert.equal(response.status, 200);
    assert.equal(body, JSON.stringify({ success: true, data: { projects: [] } }));
    assert.equal(
      (capturedHeaders as Record<string, string>).cookie,
      'accessToken=test-token'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('POST /api/projects forwards request body to backend projects endpoint', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = '';

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = String(init?.body ?? '');
    return new Response(JSON.stringify({ success: true, data: { id: 'project-1' } }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const request = new NextRequest('http://127.0.0.1:3101/api/projects/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Demo Project' }),
    });

    const response = await POST(request);
    const body = await response.text();

    assert.equal(response.status, 201);
    assert.equal(capturedBody, JSON.stringify({ name: 'Demo Project' }));
    assert.equal(body, JSON.stringify({ success: true, data: { id: 'project-1' } }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
