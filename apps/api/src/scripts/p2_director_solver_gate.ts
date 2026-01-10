import { DirectorConstraintSolverService } from '../shot-director/director-solver.service';
import { DirectorShotInput } from '../shot-director/director-rule.types';
import * as fs from 'fs';
import * as path from 'path';
import * as util from "util";

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(`ASSERT_FAIL: ${msg}`);
}

export function runDirectorSolverGate(outDir: string) {
  const solver = new DirectorConstraintSolverService();

  const validShots: DirectorShotInput[] = [
    {
      id: 'valid_1',
      type: 'CLOSE_UP',
      params: {
        prompt: 'A close-up of a face with soft light.',
        durationSec: 4,
        motion: 'NONE',
        composition: 'TIGHT',
      },
    },
    {
      id: 'valid_2',
      type: 'WIDE_SHOT',
      params: {
        prompt: 'A wide landscape with distant mountains.',
        durationSec: 8,
        motion: 'NONE',
        composition: 'WIDE',
      },
    },
    {
      id: 'valid_3',
      type: 'MEDIUM_SHOT',
      params: {
        prompt: 'A person walking through a corridor, calm mood.',
        durationSec: 6,
        motion: 'PAN',
        composition: 'NORMAL',
      },
    },
  ];

  const invalidShots: DirectorShotInput[] = [
    // missing prompt + duration out of range
    {
      id: 'bad_1',
      type: 'DEFAULT',
      params: { prompt: '', durationSec: 0, motion: 'NONE', composition: 'NORMAL' },
    },
    // fast motion too long
    {
      id: 'bad_2',
      type: 'MEDIUM_SHOT',
      params: {
        prompt: 'Camera pans fast across the room with details.',
        durationSec: 12,
        motion: 'PAN',
        composition: 'NORMAL',
      },
    },
    // composition incompatible
    {
      id: 'bad_3',
      type: 'CLOSE_UP',
      params: {
        prompt: 'Close-up shot but composition is wide.',
        durationSec: 5,
        motion: 'NONE',
        composition: 'WIDE',
      },
    },
  ];

  const all = [...validShots, ...invalidShots];
  const results = all.map((s) => ({ shot: s, result: solver.validateShot(s) }));

  const validResults = results.filter((r) => r.shot.id.startsWith('valid_'));
  const invalidResults = results.filter((r) => r.shot.id.startsWith('bad_'));

  const validPass = validResults.filter((r) => r.result.violations.length === 0).length;
  const invalidCatch = invalidResults.filter((r) => r.result.violations.length > 0).length;

  // HARD ASSERTIONS
  assert(
    validPass === validResults.length,
    `Valid shots must have 0 violations (got ${validPass}/${validResults.length})`
  );
  assert(
    invalidCatch === invalidResults.length,
    `Invalid shots must be caught (got ${invalidCatch}/${invalidResults.length})`
  );

  const totalViolations = results.reduce((n, r) => n + r.result.violations.length, 0);
  const totalSuggestions = results.reduce((n, r) => n + r.result.suggestions.length, 0);

  // every invalid must have structured suggestions
  for (const r of invalidResults) {
    assert(r.result.suggestions.length > 0, `Invalid shot ${r.shot.id} must have suggestions`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'director_solver_proof.json'),
    JSON.stringify(results, null, 2)
  );

  const evidence = [
    `[P2 Director Solver Gate PASS - ${new Date().toString()}]`,
    `TOTAL_SHOTS_TESTED: ${all.length}`,
    `VIOLATIONS_DETECTED: ${totalViolations}`,
    `SUGGESTIONS_GENERATED: ${totalSuggestions}`,
    `VALID_SHOTS_PASS_RATE: 100% (${validPass}/${validResults.length})`,
    `INVALID_SHOTS_CATCH_RATE: 100% (${invalidCatch}/${invalidResults.length})`,
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'FINAL_6LINE_EVIDENCE.txt'), evidence);
}

if (require.main === module) {
  const outDir = process.env.EVID_DIR || 'docs/_evidence/p2_director_solver_local';
  runDirectorSolverGate(outDir);
  // eslint-disable-next-line no-console
  process.stdout.write(util.format(`OK: evidence at ${outDir}`) + "\n");
}
