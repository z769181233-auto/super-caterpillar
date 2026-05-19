import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET } from './route';

test('GET /api/projects/[projectId]/overview forwards cookies to backend overview endpoint', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedHeaders: HeadersInit | undefined;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedHeaders = init?.headers;
    return new Response(JSON.stringify({ success: true, data: { runningJobs: [] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const request = new NextRequest('http://127.0.0.1:3101/api/projects/project-1/overview', {
      headers: { cookie: 'accessToken=test-token' },
    });

    const response = await GET(request, { params: Promise.resolve({ projectId: 'project-1' }) });
    const body = await response.text();

    assert.equal(capturedUrl.endsWith('/api/projects/project-1/overview'), true);
    assert.equal(response.status, 200);
    assert.equal(body, JSON.stringify({ success: true, data: { runningJobs: [] } }));
    assert.equal((capturedHeaders as Record<string, string>).cookie, 'accessToken=test-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
