import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectDetailHref, getProjectsCreateHref, normalizeCreateProjectPayload } from './project-create-flow';

test('normalizeCreateProjectPayload trims values and omits empty description', () => {
  const payload = normalizeCreateProjectPayload('  Demo Project  ', '   ');

  assert.deepEqual(payload, {
    name: 'Demo Project',
  });
});

test('normalizeCreateProjectPayload keeps non-empty description', () => {
  const payload = normalizeCreateProjectPayload('Demo Project', '  Story outline  ');

  assert.deepEqual(payload, {
    name: 'Demo Project',
    description: 'Story outline',
  });
});

test('normalizeCreateProjectPayload rejects empty names', () => {
  assert.throws(
    () => normalizeCreateProjectPayload('   ', 'desc'),
    /PROJECT_NAME_REQUIRED/
  );
});

test('getProjectDetailHref builds locale-aware project routes', () => {
  assert.equal(getProjectDetailHref('zh', 'project-123'), '/zh/projects/project-123');
});

test('getProjectsCreateHref builds locale-aware create routes', () => {
  assert.equal(getProjectsCreateHref('zh'), '/zh/projects?create=1');
  assert.equal(getProjectsCreateHref('en'), '/en/projects?create=1');
});
