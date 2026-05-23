import assert from 'node:assert/strict';
import test from 'node:test';
import { novelImportApi } from './apiClient';

test('novel import client uses trailing-slash routes for file import and analysis flow', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: String(init?.method || 'GET'),
    });

    return new Response(JSON.stringify({ success: true, data: { ok: true, jobs: [] } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const file = new File(['hello'], 'demo.txt', { type: 'text/plain' });

    await novelImportApi.importNovelFile('project-1', file, { title: 'Demo', author: 'Tester' });
    await novelImportApi.importNovel('project-1', { title: 'Demo', rawText: 'Body' });
    await novelImportApi.analyzeNovel('project-1');
    await novelImportApi.getNovelJobs('project-1');

    assert.deepEqual(
      calls.map((call) => ({ url: call.url, method: call.method })),
      [
        { url: '/api/projects/project-1/novel/import-file/', method: 'POST' },
        { url: '/api/projects/project-1/novel/import/', method: 'POST' },
        { url: '/api/projects/project-1/novel/analyze/', method: 'POST' },
        { url: '/api/projects/project-1/novel/jobs/', method: 'GET' },
      ]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
