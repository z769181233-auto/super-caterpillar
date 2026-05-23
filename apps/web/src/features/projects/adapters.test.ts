import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptProjects } from './adapters';

test('adaptProjects maps in_progress to RUNNING and prefers updatedAt', () => {
  const [project] = adaptProjects([
    {
      id: 'project-1',
      name: 'Demo',
      status: 'in_progress',
      createdAt: '2026-04-30T10:01:12.000Z',
      updatedAt: '2026-04-30T10:17:45.000Z',
      stats: { seasonsCount: 1, scenesCount: 3, shotsCount: 8 },
    },
  ]);

  assert.equal(project.latestBuild?.status, 'RUNNING');
  assert.equal(project.updatedAt, '2026-04-30T10:17:45.000Z');
  assert.equal(project.stats?.episodes, 3);
});
