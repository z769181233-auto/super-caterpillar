import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStudioV2Nav } from './studio-navigation';

test('buildStudioV2Nav returns locale-aware Studio v2 paths', () => {
  const nav = buildStudioV2Nav('zh', 'project-1', 'episode-9');
  const byId = new Map(nav.map((item) => [item.id, item.href]));

  assert.equal(byId.get('overview'), '/zh/projects/project-1/studio');
  assert.equal(byId.get('source'), '/zh/projects/project-1/studio/source');
  assert.equal(byId.get('audit'), '/zh/projects/project-1/studio/audit');
  assert.equal(byId.get('shots'), '/zh/projects/project-1/studio/episodes/episode-9/shots');
  assert.equal(byId.get('storyboards'), '/zh/projects/project-1/studio/episodes/episode-9/storyboards');
  assert.equal(byId.get('videos'), '/zh/projects/project-1/studio/episodes/episode-9/videos');
  assert.equal(byId.get('review'), '/zh/projects/project-1/studio/review');
  assert.equal(byId.get('export'), '/zh/projects/project-1/studio/export');
});
