import { PrismaClient } from 'database';
import { processIdentityLockJob } from '../../../apps/workers/src/processors/ce02-identity-lock.processor';
import { ApiClient } from '../../../apps/workers/src/api-client';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Mock ApiClient to satisfy Type System
class MockApiClient extends ApiClient {
  constructor() {
    super('http://localhost:3000', 'mock-token');
  }

  // Override public method to match signature
  async postAuditLog(data: any): Promise<{ success: boolean }> {
    console.log('[MockApi] AuditLog:', data.action, data.status);
    return { success: true };
  }
}

async function run() {
  const prisma = new PrismaClient();
  console.log('[Gate] Connected to DB');

  const projectId = 'proj-gate-ce02-' + Date.now();
  const characterId = 'char-gate-ce02-' + Date.now();

  const mockJob = {
    id: 'job-gate-' + Date.now(),
    type: 'CE02_IDENTITY_LOCK',
    projectId: projectId,
    payload: {
      characterId: characterId,
      seed: 12345,
      forceRebuild: true,
    },
    traceId: 'trace-gate-' + Date.now(),
  };

  try {
    console.log('[Gate] Invoking Processor...');

    // Setup Mock
    const mockApi = new MockApiClient();

    // Force Override private request method via any cast
    (mockApi as any).request = async (method: string, url: string, data: any) => {
      if (url.includes('/api/_internal/engine/invoke')) {
        console.log(`[MockApi] Intercepted Engine Invoke: ${data.engineKey}`);

        // Generate Dummy Asset for Validation
        const dummyImgPath = path.resolve(
          process.cwd(),
          'apps/workers/.runtime/assets/dummy_gate.png'
        );
        if (!fs.existsSync(path.dirname(dummyImgPath)))
          fs.mkdirSync(path.dirname(dummyImgPath), { recursive: true });

        // Use Sharp to create real image if missing
        if (!fs.existsSync(dummyImgPath)) {
          const sharp = require('sharp');
          await sharp({
            create: {
              width: 1024,
              height: 1024,
              channels: 4,
              background: { r: 255, g: 0, b: 0, alpha: 1 },
            },
          })
            .png()
            .toFile(dummyImgPath);
        }

        return {
          success: true,
          data: {
            success: true,
            output: {
              asset: {
                uri: path.relative(process.cwd(), dummyImgPath), // Relative to SSOT Root (CWD)
                sha256: 'mock-sha',
                mimeType: 'image/png',
                width: 1024,
                height: 1024,
              },
              audit_trail: {
                engineKey: 'test',
                timestamp: new Date().toISOString(),
              },
            },
          },
        };
      }
      return { success: true };
    };

    // Invoke
    const result = await processIdentityLockJob({
      prisma,
      job: mockJob as any,
      apiClient: mockApi,
      workerId: 'gate-worker',
    });

    console.log('[Gate] Processor Result:', result);

    if (result.status !== 'SUCCESS') throw new Error('Processor failed');
    if (!result.anchor) throw new Error('No anchor returned');

    // Assert DB
    const anchor = await prisma.characterIdentityAnchor.findUnique({
      where: { id: result.anchor.id },
    });
    if (!anchor) throw new Error('Anchor not found in DB');
    if (anchor.status !== 'READY') throw new Error(`Anchor status ${anchor.status} != READY`);
    if (!anchor.isActive) throw new Error('Anchor is not Active');
    if (anchor.seed !== 12345) throw new Error(`Seed mismatch: ${anchor.seed}`);

    // Assert Files
    const root = process.env.SSOT_ROOT || process.cwd();
    const views = ['front', 'side', 'back'];
    for (const v of views) {
      const p = path.join(root, 'characters', characterId, 'identity', anchor.id, `${v}.png`);
      if (!fs.existsSync(p)) throw new Error(`Missing view file: ${p}`);
      console.log(`[Gate] Verified file exists: ${p}`);
    }

    // Verify Active Uniqueness
    console.log('[Gate] Testing Uniqueness...');
    const result2 = await processIdentityLockJob({
      prisma,
      job: {
        ...mockJob,
        id: mockJob.id + '_2',
        payload: { ...mockJob.payload, forceRebuild: true },
      } as any,
      apiClient: mockApi,
      workerId: 'gate-worker-2',
    });

    const anchor2 = await prisma.characterIdentityAnchor.findUnique({
      where: { id: result2.anchor.id },
    });
    const oldAnchor = await prisma.characterIdentityAnchor.findUnique({ where: { id: anchor.id } });

    if (result2.status !== 'SUCCESS') throw new Error('Second run failed');
    if (!anchor2?.isActive) throw new Error('New anchor not active');
    if (oldAnchor?.isActive) throw new Error('Old anchor still active');

    console.log('[Gate] SUCCESS');
  } catch (e) {
    console.error('[Gate] FAILED:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
