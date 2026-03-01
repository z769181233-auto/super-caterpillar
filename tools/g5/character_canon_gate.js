const fs = require('fs');
const path = require('path');

/**
 * P2-3: Character Canon Gate
 * 核心：物理审计角色资产是否满足 8K / Grade S 门槛。
 */
async function auditCharacterAsset(characterId) {
  const assetPath = path.join(process.cwd(), 'assets/characters', characterId);
  const metaPath = path.join(assetPath, 'asset_meta.json');
  const canonPath = path.join(process.cwd(), 'docs/_specs', `CANON_CHARACTER_${characterId}.md`);

  if (!fs.existsSync(metaPath)) throw new Error(`MISSING_META: ${characterId}`);
  if (!fs.existsSync(canonPath)) throw new Error(`MISSING_CANON_SPECS: ${characterId}`);

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const auditReport = {
    characterId,
    timestamp: new Date().toISOString(),
    verdict: 'PASS',
    checks: [],
  };

  // 1. Resolution Check
  const minFaceDensity = 6000;
  const isResPass = meta.physical_specs.face_density_px >= minFaceDensity;
  auditReport.checks.push({
    id: 'RESOLUTION_DENSITY',
    expected: `>=${minFaceDensity}px`,
    actual: `${meta.physical_specs.face_density_px}px`,
    status: isResPass ? 'PASS' : 'FAIL',
  });

  // 2. Asset Integrity (Mocked for P2-3 development)
  const requiredDirs = ['mesh', 'textures/8k', 'groom', 'clothing'];
  for (const dir of requiredDirs) {
    const fullDir = path.join(assetPath, dir);
    const exists = fs.existsSync(fullDir);
    auditReport.checks.push({
      id: `STRUCTURE_${dir.toUpperCase()}`,
      status: exists ? 'PASS' : 'FAIL',
    });
  }

  if (auditReport.checks.some((c) => c.status === 'FAIL')) {
    auditReport.verdict = 'FAIL';
  }

  const reportPath = path.join(process.cwd(), 'character_canon_audit.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
  console.log(`[P2-Audit] Character Canon Gate Conclusion Saved to ${reportPath}`);
  return auditReport;
}

const targetChar = process.argv[2] || 'XueZhiYing';
auditCharacterAsset(targetChar).catch((err) => {
  console.error(`[AUDIT_FAILED] ${err.message}`);
  process.exit(1);
});
