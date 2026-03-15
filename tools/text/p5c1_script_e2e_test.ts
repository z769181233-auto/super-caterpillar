import { PrismaClient } from 'database';
import {
  processScriptOutlineJob,
  processSceneSplitJob,
  processShotSplitJob,
  processContinuityAuditJob,
} from '../../apps/workers/src/processors/script-structure.processor';

const prisma = new PrismaClient({});
const PROJECT_ID = 'proj_15m_seal_001';
const SOURCE_ID = '7cbf8a3e-bc87-4ea8-94b9-2dbd41f68b37'; // Byte-Aligned V2

async function runHardenedFinalE2E() {
  console.log('--- P5-C HARDENING FINAL E2E Test ---');

  // 1. Create ScriptBuild
  const build = await prisma.scriptBuild.create({
    data: {
      projectId: PROJECT_ID,
      sourceId: SOURCE_ID,
      version: 'INDUSTRIAL-SEAL-001',
      status: 'PENDING',
    },
  });
  console.log(`Created ScriptBuild: ${build.id}`);

  // 2. CE06: Script Outline
  console.log('\n[Phase 1] Executing CE06_SCRIPT_OUTLINE...');
  await processScriptOutlineJob({
    prisma,
    job: { payload: { sourceId: SOURCE_ID, buildId: build.id, projectId: PROJECT_ID } } as any,
    apiClient: {} as any,
    localStorage: {} as any,
  });

  const episodes = await prisma.episode.findMany({
    where: { buildId: build.id },
    orderBy: { index: 'asc' },
  });
  console.log(`Generated ${episodes.length} Episodes.`);

  for (const ep of episodes) {
    // 3. CE11: Scene Split
    console.log(`\n[Phase 2] Executing CE11_SCENE_SPLIT for Episode ${ep.index}...`);
    await processSceneSplitJob({
      prisma,
      job: { payload: { episodeId: ep.id, buildId: build.id, projectId: PROJECT_ID } } as any,
      apiClient: {} as any,
      localStorage: {} as any,
    });

    const scenes = await prisma.scene.findMany({
      where: { episodeId: ep.id },
      orderBy: { sceneIndex: 'asc' },
    });

    for (const sc of scenes) {
      // 4. CE12: Shot Split
      console.log(`  - Executing CE12_SHOT_SPLIT for Scene ${sc.sceneIndex}...`);
      await processShotSplitJob({
        prisma,
        job: { payload: { sceneId: sc.id, buildId: build.id, projectId: PROJECT_ID } } as any,
        apiClient: {} as any,
        localStorage: {} as any,
      });
    }
  }

  // 5. CE99: Hardened Continuity Audit
  console.log('\n[Phase 3] Executing CE99_CONTINUITY_AUDIT (Hardened)...');
  const auditRes = await processContinuityAuditJob({
    prisma,
    job: { payload: { buildId: build.id, projectId: PROJECT_ID } } as any,
    apiClient: {} as any,
    localStorage: {} as any,
  });

  console.log('\nAudit Results:');
  console.log(JSON.stringify(auditRes.output, null, 2));

  if (auditRes.output.isIndustrialSealed) {
    console.log('\n✅ INDUSTRIAL SEALED PASSED! SSOT IS IRREVERSIBLE AND COMPLETE.');
  } else {
    console.log('\n❌ HARDENING FAILED. Check logs.');
  }
}

runHardenedFinalE2E()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
