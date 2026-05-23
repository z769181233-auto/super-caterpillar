import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldPollProjectDetail, shouldPollProjects } from './project-status-polling';

test('shouldPollProjects only while any project card is running', () => {
  assert.equal(
    shouldPollProjects([
      {
        id: 'p-1',
        title: 'Done',
        updatedAt: '2026-05-08T00:00:00.000Z',
        latestBuild: { id: 'b-1', status: 'DONE', audited: true, sealed: true },
        stats: { seasons: 0, episodes: 1, scenes: 0, shots: 0 },
        tags: [],
      },
    ]),
    false
  );

  assert.equal(
    shouldPollProjects([
      {
        id: 'p-2',
        title: 'Running',
        updatedAt: '2026-05-08T00:00:00.000Z',
        latestBuild: { id: 'b-2', status: 'RUNNING', audited: false, sealed: false },
        stats: { seasons: 0, episodes: 1, scenes: 0, shots: 0 },
        tags: [],
      },
    ]),
    true
  );
});

test('shouldPollProjectDetail while project or novel analysis remains active', () => {
  assert.equal(
    shouldPollProjectDetail({
      id: 'project-1',
      name: 'Done Project',
      organizationId: 'org-1',
      status: 'READY',
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
      stats: {
        buildsCount: 1,
        structuralStatus: 'Audited',
        usage: '--',
        novelAnalysisStatus: 'SUCCEEDED',
        latestNovelJobId: 'job-1',
        latestNovelJobType: 'NOVEL_ANALYSIS',
        latestNovelJobUpdatedAt: '2026-05-08T00:00:00.000Z',
      },
      audit: {
        fingerprintStatus: 'AUDITED',
        rulesVersion: 'v1.1-LAUNCH',
      },
    }),
    false
  );

  assert.equal(
    shouldPollProjectDetail({
      id: 'project-2',
      name: 'Pending Project',
      organizationId: 'org-1',
      status: 'RUNNING',
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
      stats: {
        buildsCount: 1,
        structuralStatus: 'Audited',
        usage: '--',
        novelAnalysisStatus: 'PENDING',
        latestNovelJobId: 'job-2',
        latestNovelJobType: 'NOVEL_ANALYSIS',
        latestNovelJobUpdatedAt: '2026-05-08T00:00:00.000Z',
      },
      audit: {
        fingerprintStatus: 'UNKNOWN',
        rulesVersion: 'v1.1-LAUNCH',
      },
    }),
    true
  );
});
