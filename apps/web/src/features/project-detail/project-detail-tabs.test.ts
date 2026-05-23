import assert from 'node:assert/strict';
import test from 'node:test';
import { getProjectDetailTabFromModule } from './project-detail-tabs';

test('structure module opens the screenplay result tab', () => {
  assert.equal(getProjectDetailTabFromModule('structure'), 'script');
  assert.equal(getProjectDetailTabFromModule('script'), 'script');
});

test('unknown project detail module falls back to overview', () => {
  assert.equal(getProjectDetailTabFromModule(null), 'overview');
  assert.equal(getProjectDetailTabFromModule('unknown'), 'overview');
});
