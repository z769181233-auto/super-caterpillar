import assert from 'node:assert/strict';
import test from 'node:test';
import { extractStudioApiErrorMessage } from './studio-api-errors';

test('extractStudioApiErrorMessage prefers nested API envelope error message', () => {
  const message = extractStudioApiErrorMessage(
    { error: { message: 'No usable scene candidates found for EpisodePlan generation.' } },
    'fallback'
  );

  assert.equal(message, 'No usable scene candidates found for EpisodePlan generation.');
});

test('extractStudioApiErrorMessage reads Nest top-level message', () => {
  const message = extractStudioApiErrorMessage(
    {
      message:
        'No stable scene candidate evidence found for DirectorScript generation.\nNext action: rerun novel analysis quality pipeline and regenerate upstream Studio text outputs from coverageReport.sceneCandidates.',
    },
    'fallback'
  );

  assert.match(message, /coverageReport\.sceneCandidates/);
});

test('extractStudioApiErrorMessage joins validation message arrays', () => {
  const message = extractStudioApiErrorMessage(
    {
      message: ['field A is required', 'field B must be a string'],
    },
    'fallback'
  );

  assert.equal(message, 'field A is required\nfield B must be a string');
});

test('extractStudioApiErrorMessage falls back for empty or unknown payloads', () => {
  assert.equal(extractStudioApiErrorMessage({ message: '' }, 'fallback'), 'fallback');
  assert.equal(extractStudioApiErrorMessage(null, 'fallback'), 'fallback');
});
