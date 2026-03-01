import { PrismaClient } from 'database';
import { processShotRenderJob } from '../../../apps/workers/src/processors/shot-render.processor';
import { ApiClient } from '../../../apps/workers/src/api-client';
import * as fs from 'fs';
import * as path from 'path';

class MockApiClient extends ApiClient {
  constructor() {
    super('http://mock', 'token');
  }
  async postAuditLog(data: any) {
    return { success: true };
  }
}

async function run() {
  console.log('[GateConsistency] Starting ShotRender Consistency Test...');
  const prisma = new PrismaClient();

  const charId = 'char-consist-' + Date.now();
  const projectId = 'proj-consist-' + Date.now();
  const anchorId = 'anchor-consist-' + Date.now();

  const shot1Id = 'shot-c1-' + Date.now();
  const shot2Id = 'shot-c2-' + Date.now(); // Different Shot

  const job1Id = 'job-c1-' + Date.now();
  const job2Id = 'job-c2-' + Date.now();

  try {
    // 1. Create Active Anchor
    await prisma.characterIdentityAnchor.create({
      data: {
        id: anchorId,
        characterId: charId,
        status: 'READY',
        isActive: true,
        provider: 'test',
        seed: 7777, // Specific seed for consistency check
        viewKeysSha256: 'consistent-hash-123',
      },
    });

    // 2. Mock Prisma & API
    const createPrismaProxy = (currentShotId: string) => {
      return new Proxy(prisma, {
        get: (target, prop) => {
          if (prop === 'shot') {
            return {
              findUnique: async () => ({
                id: currentShotId,
                enrichedPrompt: 'Prompt ' + currentShotId,
                params: { characterIds: [charId] },
                scene: { episode: { season: { project: { id: projectId } } } },
                organization: { id: 'org-consist' },
                sceneId: 'scene-consist',
              }),
              update: async () => ({ id: currentShotId }),
            };
          }
          if (prop === 'asset') {
            return {
              upsert: async () => ({ id: 'asset-' + currentShotId }),
              update: async () => ({ id: 'asset-' + currentShotId }),
              findUnique: async () => null,
            };
          }
          if (prop === 'auditLog') {
            return {
              create: async (args: any) => {
                // STRIP FKs to allow real insert
                const safeData = {
                  ...args.data,
                  orgId: undefined,
                  userId: undefined,
                  apiKeyId: undefined,
                };
                // Ensure we log correlation ID for easier SQL query?
                // We have jobId in details.
                return target.auditLog.create({ data: safeData });
              },
            };
          }
          if (prop === '$transaction') return target.$transaction;
          return (target as any)[prop];
        },
      });
    };

    const mockApi = new MockApiClient();
    // Dynamic request mock
    (mockApi as any).request = async (method: string, url: string, data: any) => {
      const isInvoke = url.includes('engine/invoke');
      if (isInvoke) {
        const engineKey = (data as any).engineKey;
        // Manual Audit Logging for Consistency Check
        const currentJobId = (data as any).context?.jobId;
        if (currentJobId) {
          await prisma.auditLog.create({
            data: {
              action: 'ENGINE_INVOKE',
              resourceType: 'ENGINE',
              resourceId: engineKey,
              details: {
                jobId: currentJobId,
                identity: (data as any).context?.identity,
              },
            },
          });
        }

        if (engineKey === 'ce23_identity_consistency') {
          return {
            success: true,
            data: {
              status: 'SUCCESS',
              output: { is_consistent: true, identity_score: 0.99 },
            },
          };
        }
        return {
          success: true,
          data: {
            status: 'SUCCESS',
            output: {
              asset: { uri: path.resolve(process.cwd(), 'apps/workers/.runtime/mock_render.png') },
              render_meta: { engine: 'mock' },
              audit_trail: { providerSelected: 'mock' },
              storageKey: 'mock_render.png',
              sha256: 'mock_hash',
            },
          },
        };
      }
      return { success: true, data: { success: true } };
    };

    // Mock File
    const mockFile = path.resolve(process.cwd(), 'apps/workers/.runtime/mock_render.png');
    if (!fs.existsSync(path.dirname(mockFile)))
      fs.mkdirSync(path.dirname(mockFile), { recursive: true });
    fs.writeFileSync(mockFile, 'fake image');

    // 3. Run Job 1
    console.log(`[GateConsistency] Running Job 1 (${job1Id})...`);
    await processShotRenderJob({
      prisma: createPrismaProxy(shot1Id) as any,
      job: {
        id: job1Id,
        shotId: shot1Id,
        payload: { pipelineRunId: 'run-c', characterIds: [charId] },
      } as any,
      apiClient: mockApi,
    });

    // 4. Run Job 2
    console.log(`[GateConsistency] Running Job 2 (${job2Id})...`);
    await processShotRenderJob({
      prisma: createPrismaProxy(shot2Id) as any,
      job: {
        id: job2Id,
        shotId: shot2Id,
        payload: { pipelineRunId: 'run-c', characterIds: [charId] },
      } as any,
      apiClient: mockApi,
    });

    // Output Job IDs for SQL Query
    console.log(`JOB_IDS=${job1Id},${job2Id}`);

    // Write to file as well for Bash to pick up
    const evdDir = fs.readFileSync('.current_evidence_dir', 'utf-8').trim();
    fs.writeFileSync(path.join(evdDir, 'SHOT_RENDER_JOB_IDS.txt'), `${job1Id}\n${job2Id}`);

    console.log('[GateConsistency] Logic Runner Done.');
  } catch (e) {
    console.error('[GateConsistency] FAILED', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
