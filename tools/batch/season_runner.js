const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

/**
 * Season Batch Runner (Phase G)
 *
 * Orchestrates the full production pipeline for a batch of episodes.
 * - Scan Season Directory
 * - Calculate RunKey (Idempotency)
 * - Execute Gates (Lint, Scorecard, CostBudget)
 * - Compile & Render (Dry-Run)
 * - Generate Summary Report
 * - Generate Season Cost Ledger
 */

const seasonDir = process.argv[2];
const eviRoot = process.argv[3];
const FPS = 24;
const BUDGET_FILE = path.join(__dirname, '../../docs/budgets/season_01_budget.json');

if (!seasonDir || !eviRoot) {
  console.error('Usage: node season_runner.js <season_dir> <evidence_root>');
  process.exit(1);
}

// 0. Load Render Map SSOT
const renderMapPath = path.join(__dirname, '../../docs/assets/render_map.json');
const renderMapContent = fs.readFileSync(renderMapPath, 'utf8');
const RENDER_MAP = JSON.parse(renderMapContent);
const renderMapSha = crypto.createHash('sha256').update(renderMapContent).digest('hex');
const renderContractVersion = RENDER_MAP.renderContractVersion || '0.0.0';

console.log(`=== Season Batch Runner Started ===`);
console.log(`Season Dir: ${seasonDir}`);
console.log(`Evidence Root: ${eviRoot}`);
console.log(`Contract: v${renderContractVersion} (SHA: ${renderMapSha.substring(0, 8)})`);

// 1. Scan Episodes
const files = fs.readdirSync(seasonDir).filter((f) => f.endsWith('.shot.json'));
console.log(`Found ${files.length} episodes.`);

const batchSummary = {
  timestamp: new Date().toISOString(),
  totalEpisodes: files.length,
  passedCount: 0,
  failedCount: 0,
  episodes: [],
};

const costLedger = {
  seasonId: 'season_01',
  timestamp: batchSummary.timestamp,
  totalSeasonCostUnits: 0,
  episodes: [],
};

// Ensure batch evidence root exists
fs.mkdirSync(eviRoot, { recursive: true });

// 2. Process Each Episode
for (const file of files) {
  const shotPath = path.join(seasonDir, file);
  const episodeId = path.basename(file, '.shot.json');
  const episodeEviDir = path.join(eviRoot, episodeId);

  console.log(`\n--- Processing ${episodeId} ---`);
  fs.mkdirSync(episodeEviDir, { recursive: true });

  const startTime = Date.now();
  let status = 'PENDING';
  let failureReason = null;
  let runKey = null;

  try {
    // A. RunKey Calculation
    const shotContent = fs.readFileSync(shotPath, 'utf8');
    const shotSpec = JSON.parse(shotContent);
    const shotSha = crypto.createHash('sha256').update(shotContent).digest('hex');
    runKey = crypto
      .createHash('sha256')
      .update(episodeId + renderContractVersion + renderMapSha + shotSha)
      .digest('hex');

    // G2.1: Dynamic Frame Count Assertion
    const durationSec =
      shotSpec.episodeMeta && shotSpec.episodeMeta.durationSec
        ? shotSpec.episodeMeta.durationSec
        : 0;
    const expectedFrames = Math.round(durationSec * FPS);

    console.log(`RunKey: ${runKey}`);
    console.log(`Duration: ${durationSec}s -> Expected Frames: ${expectedFrames}`);

    if (expectedFrames <= 0) {
      throw new Error('Invalid durationSec in episodeMeta: ' + durationSec);
    }

    // Env for child processes
    const childEnv = { ...process.env, EVI: episodeEviDir };

    // B. Execute Lint Gate
    console.log(`[Gate] Script Lint...`);
    execSync(`node tools/script_gates/p0_lint.js "${shotPath}" "${episodeEviDir}"`, {
      stdio: 'inherit',
      env: childEnv,
    });

    // C. Execute Scorecard Gate
    console.log(`[Gate] Script Scorecard...`);
    execSync(`node tools/script_gates/p1_scorecard.js "${shotPath}" "${episodeEviDir}"`, {
      stdio: 'inherit',
      env: childEnv,
    });

    // D. Compilation & Real Render Dry-Run
    // 1. Compile (Outputs RenderPlan + CostEstimate)
    console.log(`[Compile] Render Plan...`);
    const planPath = path.join(episodeEviDir, 'plan.json');
    execSync(
      `node tools/script_compiler/shot_to_render_plan.js "${shotPath}" "${planPath}" "${episodeEviDir}"`,
      { stdio: 'inherit', env: childEnv }
    );

    // G3: Cost Budget Gate
    console.log(`[Gate] Cost Budget...`);
    const costEstimatePath = path.join(episodeEviDir, 'cost_estimate.json');
    execSync(`tools/gate/gates/gate-cost-budget.sh "${costEstimatePath}" "${BUDGET_FILE}"`, {
      stdio: 'inherit',
      env: childEnv,
    });

    // Accumulate to Ledger
    const costEst = JSON.parse(fs.readFileSync(costEstimatePath, 'utf8'));
    costLedger.totalSeasonCostUnits += costEst.totalCostUnits;
    costLedger.episodes.push({
      episodeId,
      runKey,
      totalCostUnits: costEst.totalCostUnits,
    });

    // 2. Render R1 (Stub)
    console.log(`[Render] Stub R1...`);
    const r1Path = path.join(episodeEviDir, 'preview_stub_R1.mp4');
    execSync(`node tools/renderer/stub_renderer.js "${planPath}" "${r1Path}" "${episodeEviDir}"`, {
      stdio: 'inherit',
      env: childEnv,
    });
    const r1Sha = crypto.createHash('sha256').update(fs.readFileSync(r1Path)).digest('hex');
    fs.writeFileSync(path.join(episodeEviDir, 'preview_stub_sha256_R1.txt'), r1Sha);

    // 3. Render R2 (Stub)
    console.log(`[Render] Stub R2...`);
    const r2Path = path.join(episodeEviDir, 'preview_stub_R2.mp4');
    execSync(`node tools/renderer/stub_renderer.js "${planPath}" "${r2Path}" "${episodeEviDir}"`, {
      stdio: 'inherit',
      env: childEnv,
    });
    const r2Sha = crypto.createHash('sha256').update(fs.readFileSync(r2Path)).digest('hex');
    fs.writeFileSync(path.join(episodeEviDir, 'preview_stub_sha256_R2.txt'), r2Sha);

    // 4. Assertions
    const resolveReport = JSON.parse(
      fs.readFileSync(path.join(episodeEviDir, 'resolve_report.json'), 'utf8')
    );
    const continuityReport = JSON.parse(
      fs.readFileSync(path.join(episodeEviDir, 'frame_continuity_report.json'), 'utf8')
    );

    if (r1Sha !== r2Sha) throw new Error('Determinism Check Failed: R1 != R2');
    if (!resolveReport.passed) throw new Error('Render Plan Resolve Check Failed');
    if (!continuityReport.continuityVerified) throw new Error('Frame Continuity Check Failed');

    // Dynamic Assertion
    if (resolveReport.totalFrames !== expectedFrames) {
      throw new Error(
        `Total Frames Mismatch: Plan ${resolveReport.totalFrames} != Spec ${expectedFrames}`
      );
    }
    if (continuityReport.totalFrames !== expectedFrames) {
      throw new Error(
        `Continuity Frames Mismatch: Report ${continuityReport.totalFrames} != Spec ${expectedFrames}`
      );
    }

    status = 'PASS';
    batchSummary.passedCount++;
    console.log(`✅ ${episodeId} Processed Successfully.`);
  } catch (e) {
    status = 'FAIL';
    failureReason = e.message;
    batchSummary.failedCount++;
    console.error(`❌ ${episodeId} Failed: ${e.message}`);
  }

  const durationMs = Date.now() - startTime;
  batchSummary.episodes.push({
    episodeId,
    runKey,
    status,
    failureReason,
    durationMs,
    evidenceDir: episodeEviDir,
  });
}

// 3. Generate Manifest & Report
const manifestPath = path.join(eviRoot, 'run_manifest.json');
const reportPath = path.join(eviRoot, 'season_batch_report.json');
const ledgerPath = path.join(eviRoot, 'season_cost_ledger_evidence.json');

fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    batchSummary.episodes.map((e) => ({ episodeId: e.episodeId, runKey: e.runKey })),
    null,
    2
  )
);
fs.writeFileSync(reportPath, JSON.stringify(batchSummary, null, 2));
fs.writeFileSync(ledgerPath, JSON.stringify(costLedger, null, 2));

// Generate Ledger SHA
const ledgerSha = crypto.createHash('sha256').update(fs.readFileSync(ledgerPath)).digest('hex');
fs.writeFileSync(path.join(eviRoot, 'season_cost_ledger_sha256.txt'), ledgerSha);

console.log(`\n=== Batch Completed ===`);
console.log(
  `Total: ${batchSummary.totalEpisodes}, Pass: ${batchSummary.passedCount}, Fail: ${batchSummary.failedCount}`
);
console.log(`Report: ${reportPath}`);
console.log(`Cost Ledger: ${ledgerPath} (Total: ${costLedger.totalSeasonCostUnits.toFixed(1)} CU)`);

if (batchSummary.failedCount > 0) {
  process.exit(1);
}
