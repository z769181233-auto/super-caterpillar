import assert from 'node:assert/strict';
import test from 'node:test';
import { projectApi } from './apiClient';

test('deleteProject refreshes session and retries once after a 401', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; credentials?: RequestCredentials }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: String(init?.method || 'GET'),
      credentials: init?.credentials,
    });

    if (calls.length === 1) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (calls.length === 2) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { message: 'Project deleted successfully' },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    const result = await projectApi.deleteProject('project-1');

    assert.deepEqual(result, { message: 'Project deleted successfully' });
    assert.deepEqual(calls, [
      { url: '/api/projects/project-1/', method: 'DELETE', credentials: 'include' },
      { url: '/api/auth/refresh/', method: 'POST', credentials: 'include' },
      { url: '/api/projects/project-1/', method: 'DELETE', credentials: 'include' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deleteProject throws unauthorized when refresh does not recover the session', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; credentials?: RequestCredentials }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: String(init?.method || 'GET'),
      credentials: init?.credentials,
    });

    return new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => projectApi.deleteProject('project-1'),
      (error: unknown) => {
        assert.equal((error as Error).message, 'Unauthorized');
        assert.equal((error as { status?: number }).status, 401);
        return true;
      }
    );

    assert.deepEqual(calls, [
      { url: '/api/projects/project-1/', method: 'DELETE', credentials: 'include' },
      { url: '/api/auth/refresh/', method: 'POST', credentials: 'include' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createProject refreshes session and retries once after a 401', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; credentials?: RequestCredentials }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: String(init?.method || 'GET'),
      credentials: init?.credentials,
    });

    if (calls.length === 1) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (calls.length === 2) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { id: 'project-1', name: 'Demo project' },
      }),
      {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }
    );
  }) as typeof fetch;

  try {
    const result = await projectApi.createProject({ name: 'Demo project', description: 'desc' });

    assert.deepEqual(result, { id: 'project-1', name: 'Demo project' });
    assert.deepEqual(calls, [
      { url: '/api/projects/', method: 'POST', credentials: 'include' },
      { url: '/api/auth/refresh/', method: 'POST', credentials: 'include' },
      { url: '/api/projects/', method: 'POST', credentials: 'include' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
