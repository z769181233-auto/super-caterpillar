import { NestFactory } from '@nestjs/core';
import { EngineModule } from '../src/engines/engine.module';
import { G5SubengineHubService } from '../src/engines/g5-subengine-hub.service';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const storyPath = process.argv[2];
  const planPath = process.argv[3];
  const outputDir = process.argv[4];

  if (!storyPath || !planPath || !outputDir) {
    console.error('Usage: ts-node g5_sealing.ts <story_path> <plan_path> <output_dir>');
    process.exit(1);
  }

  console.log('[G5-BOOTSTRAP] Initializing Engine Context...');
  const app = await NestFactory.createApplicationContext(EngineModule);
  const hub = app.get(G5SubengineHubService);

  const story = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
  const renderPlan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  console.log('[G5-BOOTSTRAP] Executing Sealing Logic...');
  await hub.generateG5Manifest({
    story,
    renderPlan,
    outputDir,
    projectId: 'g5_compliant_p0',
    traceId: 'trace_' + Date.now(),
  });

  console.log('[G5-BOOTSTRAP] Sealing Complete');
  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('❌ G5 Bootstrap Error:', err);
  process.exit(1);
});
