import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImportNovelNav } from './import-novel-nav';

test('buildImportNovelNav returns locale-aware project and structure paths', () => {
  assert.deepEqual(buildImportNovelNav('zh', 'project-123'), {
    projectHref: '/zh/projects/project-123',
    structureHref: '/zh/projects/project-123/structure',
  });
});
