const fs = require('fs');
const path = require('path');

const SHOT_PLAN = process.argv[2];

if (!SHOT_PLAN) {
  console.error('Usage: node novel_semantic_gate.js <shot_plan.json>');
  process.exit(1);
}

try {
  const plan = JSON.parse(fs.readFileSync(SHOT_PLAN, 'utf8'));
  const report = {
    scan_date: new Date().toISOString(),
    total_shots: plan.shots.length,
    verdict: 'PASS',
    errors: [],
  };

  console.log(`[Semantic Gate] Scanning ${SHOT_PLAN}...`);

  plan.shots.forEach((shot) => {
    // 1. Source Atom Check (G0: Semantics First)
    if (!shot.source_atoms || shot.source_atoms.length === 0) {
      report.errors.push(`[${shot.shot_id}] MISSING_SOURCE_ATOMS: Violation of G0.`);
    }

    // 2. Camera Intent Check (G4: No Ambiguity)
    if (!shot.camera_intent || !shot.camera_intent.distance) {
      report.errors.push(`[${shot.shot_id}] MISSING_CAMERA_INTENT: Director intent undefined.`);
    }

    // 3. Action Check
    if (!shot.action || Object.keys(shot.action).length === 0) {
      report.errors.push(`[${shot.shot_id}] MISSING_ACTION: Subject is doing nothing.`);
    }
  });

  if (report.errors.length > 0) {
    report.verdict = 'FAIL';
    fs.writeFileSync('semantic_gate_report.json', JSON.stringify(report, null, 2));
    console.error('---------------------------------------------------');
    console.error('⛔ GATE FAILED: SEMANTIC VIOLATIONS DETECTED');
    console.error(report.errors.join('\n'));
    console.error('---------------------------------------------------');
    process.exit(1);
  } else {
    console.log('✅ GATE PASS: All shots semantically traceable.');
    fs.writeFileSync('semantic_gate_report.json', JSON.stringify(report, null, 2));
    process.exit(0);
  }
} catch (e) {
  console.error(`CRITICAL_ERROR: ${e.message}`);
  process.exit(1);
}
