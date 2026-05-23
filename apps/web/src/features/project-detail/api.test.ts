import assert from 'node:assert/strict';
import test from 'node:test';
import { getProjectDetail } from './api';

test('getProjectDetail exposes latest novel analysis status and job id', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    if (url.endsWith('/api/projects/project-1/')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'project-1',
            name: 'Demo Project',
            organizationId: 'org-1',
            status: 'in_progress',
            createdAt: '2026-04-30T00:00:00.000Z',
            updatedAt: '2026-04-30T01:00:00.000Z',
            episodes: [{ id: 'ep-1', index: 1, title: 'Episode 1' }],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/projects/project-1/overview/')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            runningJobs: [],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/projects/project-1/novel/jobs/')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            jobs: [
              {
                id: 'job-1',
                status: 'RUNNING',
                type: 'NOVEL_ANALYSIS',
                updatedAt: '2026-04-30T01:05:00.000Z',
              },
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;

  try {
    const detail = await getProjectDetail('project-1');

    assert.equal(detail.stats.novelAnalysisStatus, 'RUNNING');
    assert.equal(detail.stats.latestNovelJobId, 'job-1');
    assert.equal(detail.stats.latestNovelJobType, 'NOVEL_ANALYSIS');
    assert.equal(detail.stats.latestNovelJobUpdatedAt, '2026-04-30T01:05:00.000Z');
    assert.deepEqual(calls, [
      '/api/projects/project-1/',
      '/api/projects/project-1/overview/',
      '/api/projects/project-1/novel/jobs/',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getProjectDetail should not keep stale in_progress when latest novel job already succeeded', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith('/api/projects/project-2/')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'project-2',
            name: 'Stale Project',
            organizationId: 'org-1',
            status: 'in_progress',
            createdAt: '2026-05-07T03:57:00.000Z',
            updatedAt: '2026-05-07T04:09:33.000Z',
            episodes: [{ id: 'ep-1', index: 1, title: 'Episode 1' }],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/projects/project-2/overview/')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            runningJobs: [],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/api/projects/project-2/novel/jobs/')) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            jobs: [
              {
                id: 'job-2',
                status: 'SUCCEEDED',
                type: 'NOVEL_ANALYSIS',
                updatedAt: '2026-05-07T04:09:33.000Z',
              },
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;

  try {
    const detail = await getProjectDetail('project-2');

    assert.equal(detail.status, 'READY');
    assert.equal(detail.stats.novelAnalysisStatus, 'SUCCEEDED');
    assert.equal(detail.stats.latestNovelJobType, 'NOVEL_ANALYSIS');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
