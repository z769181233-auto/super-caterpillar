import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module';
import { EngineRegistry } from '../apps/api/src/engine/engine-registry.service';
import { execSync } from 'child_process';
import * as path from 'path';

async function run() {
  console.log('🚀 Starting Registry 3-State Integrity Verification');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const registry = app.get(EngineRegistry);

  // 1. Parse SSOT via JS Parser
  const parserPath = path.resolve(process.cwd(), 'tools/ssot/parse_engine_matrix_ssot.js');
  // Use quotes for path and handle potential stderr noise
  const ssotJsonRaw = execSync(`node "${parserPath}"`).toString();
  const ssot = JSON.parse(ssotJsonRaw) as {
    keys: { sealed: string[]; inprogress: string[]; planned: string[] };
    counts: { sealed: number; inprogress: number; planned: number };
  };

  const sealedKeys = new Set(ssot.keys.sealed);
  const inprogressKeys = new Set(ssot.keys.inprogress);
  const plannedKeys = new Set(ssot.keys.planned);

  const allExpectedRegistered = new Set([...ssot.keys.sealed, ...ssot.keys.inprogress]);
  const registryKeysFound: string[] = [];
  const missingInRegistry: string[] = [];
  const illegallyRegistered: string[] = [];

  console.log(`--- Statistics ---`);
  console.log(`SEALED: ${ssot.counts.sealed}`);
  console.log(`IN-PROGRESS: ${ssot.counts.inprogress}`);
  console.log(`PLANNED: ${ssot.counts.planned}`);

  // Check SEALED + IN-PROGRESS must be in Registry
  for (const key of allExpectedRegistered) {
    const adapter = registry.getAdapter(key as string);
    if (adapter) {
      registryKeysFound.push(key);
    } else {
      missingInRegistry.push(key);
    }
  }

  // Check PLANNED must NOT be in Registry
  for (const key of plannedKeys) {
    const adapter = registry.getAdapter(key as string);
    if (adapter) {
      illegallyRegistered.push(key as string);
    }
  }

  console.log(`Registry Keys Count (Expected): ${allExpectedRegistered.size}`);
  console.log(`Registry Keys Found: ${registryKeysFound.length}`);

  let failed = false;

  if (missingInRegistry.length > 0) {
    console.error(`❌ [ERROR] SEALED/IN-PROGRESS engines missing in Registry:`);
    missingInRegistry.forEach((k) => console.error(`  - ${k}`));
    failed = true;
  }

  if (illegallyRegistered.length > 0) {
    console.error(`❌ [ERROR] PLANNED engines ILLEGALLY registered in Registry:`);
    illegallyRegistered.forEach((k) => console.error(`  - ${k}`));
    failed = true;
  }

  if (!failed) {
    console.log(`✅ [PASS] Registry == SEALED ∪ IN-PROGRESS`);
    console.log(`✅ [PASS] Registry ∩ PLANNED == ∅`);
  } else {
    process.exit(1);
  }

  await app.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
