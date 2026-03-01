import path from 'path';
import { promises as fsp } from 'fs';
import { sha256File } from '../shared/hash';
import { genCrops200, NormalizedRect } from './crop';

export type CanonGuardInput = {
  shotId: string;
  projectId: string;
  organizationId: string;
  characterIds: string[];
  imagePath: string;
  auditDir: string;
  canonFreezePath: string;
  identityAnchors: { characterId: string; anchorId: string; viewKeysSha256?: string }[];
};

export type CanonGuardResult = {
  passed: boolean;
  reasons: string[];
  crops?: { key: string; path: string; sha256: string; bytes: number }[];
  reportPath?: string;
};

/**
 * P3'-4: Industrial Grade Canon Guard
 * Performs rule-based validation and auto-generates audit artifacts.
 */
export async function runCanonGuard(input: CanonGuardInput): Promise<CanonGuardResult> {
  const reasons: string[] = [];

  // 1) Load SSOT freeze (hard fail if missing)
  const freezeRaw = await fsp.readFile(input.canonFreezePath, 'utf8').catch(() => null);
  if (!freezeRaw) {
    throw new Error(`CANON_SSOT_MISSING: ${input.canonFreezePath} not found`);
  }
  const freeze = JSON.parse(freezeRaw);

  // 2) Validate characterIds + anchors (Multi-character full check)
  for (const cid of input.characterIds) {
    if (!input.identityAnchors.some((a) => a.characterId === cid)) {
      reasons.push(`IDENTITY_ANCHOR_MISSING:${cid}`);
    }
    // Deep check against freeze rules
    if (!freeze.characters || !freeze.characters[cid]) {
      reasons.push(`CANON_CHARACTER_MISSING:${cid}`);
    }
  }

  // 3) Crop rects must exist in freeze (hard requirement)
  const rects: NormalizedRect[] = freeze.audit?.crops200?.rects;
  if (!Array.isArray(rects) || rects.length < 1) {
    reasons.push('CANON_CROPS_SSOT_MISSING');
  }

  const cropsOutDir = path.join(input.auditDir, 'crops');
  let crops: { key: string; path: string; sha256: string; bytes: number }[] = [];

  // 4) Generate artifacts regardless of preliminary fail (for diagnosis)
  // But only if we have basic pathing info
  if (rects && (await fs_exists_internal(input.imagePath))) {
    try {
      const cropFiles = await genCrops200(input.imagePath, cropsOutDir, rects);
      for (const c of cropFiles) {
        const h = await sha256File(c.path);
        crops.push({ ...c, sha256: h });
      }
    } catch (e: any) {
      reasons.push(`CROP_GEN_FAILED:${e.message}`);
    }
  }

  // 5) Final Verdict & Persistence
  const imageSha = await sha256File(input.imagePath).catch(() => 'FILE_NOT_FOUND');
  const report = {
    phase: "P3'-4",
    shotId: input.shotId,
    projectId: input.projectId,
    organizationId: input.organizationId,
    timestamp: new Date().toISOString(),
    status: reasons.length === 0 ? 'PASS' : 'FAIL',
    inputs: {
      canonFreezePath: input.canonFreezePath,
      imagePath: input.imagePath,
      imageSha256: imageSha,
      characterIds: input.characterIds,
      identityAnchors: input.identityAnchors,
    },
    audit: {
      crops,
    },
    verdict: {
      status: reasons.length === 0 ? 'PASS' : 'FAIL',
      reasons,
    },
  };

  await fsp.mkdir(input.auditDir, { recursive: true });
  const reportPath = path.join(input.auditDir, `shot_gate_report_${input.shotId}.json`);
  await fsp.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  return {
    passed: reasons.length === 0,
    reasons,
    crops,
    reportPath,
  };
}

async function fs_exists_internal(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}
