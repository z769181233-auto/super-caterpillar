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
  console.log('[Gate] Starting ShotRender Identity Enforce Test...');
  const prisma = new PrismaClient();

  // Setup Data
  const charId = 'char-enforce-' + Date.now();
  const shotId = 'shot-enforce-' + Date.now();
  const jobId = 'job-enforce-' + Date.now();
  const projectId = 'proj-enforce-' + Date.now();
  const anchorId = 'anchor-enforce-' + Date.now();

  try {
    // 1. Setup DB Mocking (We will use Real DB for CharacterAnchor, but might need to Mock Shot query or seed it)
    // Seeding Shot is hard (nested relations).
    // Let's seed a real Shot/Scene/Episode/Project cascade? Or Mock Prisma?
    // Using Real DB is better for integration, but Shot hierarchy is deep.
    // Let's try to mock `prisma.shot.findUnique` by overwriting the client method relative to the context?
    // No, `processShotRenderJob` takes `context.prisma`. We can pass a proxy!

    // Create Real Character Identity Anchor (so we can find it)
    await prisma.characterIdentityAnchor.create({
      data: {
        id: anchorId,
        characterId: charId,
        status: 'READY',
        isActive: true,
        provider: 'test',
        seed: 999,
        viewKeysSha256: 'test-hash',
      },
    });

    // Mock Prisma Client for Shot Query
    const prismaProxy = new Proxy(prisma, {
      get: (target, prop) => {
        if (prop === 'shot') {
          return {
            findUnique: async () => ({
              id: shotId,
              enrichedPrompt: 'A test prompt',
              params: { characterIds: [charId] }, // <--- INJECT CHAR ID HERE
              scene: { episode: { season: { project: { id: projectId } } } },
              organization: { id: 'org-test' },
            }),
          };
        }
        if (prop === 'asset') {
          return {
            upsert: async () => ({ id: 'asset-mock-' + Date.now() }),
            findUnique: async () => null, // For VIDEO_RENDER check
          };
        }
        if (prop === 'auditLog') {
          return {
            create: async (args: any) => {
              // STRIP FKs to allow real insert without dependencies
              const safeData = {
                ...args.data,
                orgId: undefined,
                userId: undefined,
                apiKeyId: undefined,
              };
              // Call REAL create
              return target.auditLog.create({ data: safeData });
            },
          };
        }
        if (prop === '$transaction') return target.$transaction;
        return (target as any)[prop];
      },
    });

    const mockApi = new MockApiClient();
    let engineInvokedMeta: any = null;

    // Mock EngineHub via ApiClient interception
    (mockApi as any).request = async (method: string, url: string, data: any) => {
      if (url.includes('engine/invoke')) {
        console.log(`[MockApi] Engine Invoke: ${data.engineKey}`);
        if (data.engineKey === 'shot_render') {
          engineInvokedMeta = data.metadata; // CAPTURE METADATA
          return {
            success: true,
            data: {
              success: true,
              output: {
                asset: {
                  uri: path.resolve(process.cwd(), 'apps/workers/.runtime/mock_render.png'),
                },
                render_meta: { engine: 'mock' },
                audit_trail: { providerSelected: 'mock' },
              },
            },
          };
        }
        // CE02 result
        return { success: true, data: { success: true, output: {} } };
      }
      // Billing etc
      return { success: true, data: { success: true } };
    };

    // Prepare Mock Asset File
    const mockFile = path.resolve(process.cwd(), 'apps/workers/.runtime/mock_render.png');
    if (!fs.existsSync(path.dirname(mockFile)))
      fs.mkdirSync(path.dirname(mockFile), { recursive: true });
    fs.writeFileSync(mockFile, 'fake image');

    // --- TEST 1: SUCCESS CASE ---
    console.log('[Test 1] Expect Success (Anchor exists)...');
    await processShotRenderJob({
      prisma: prismaProxy as any,
      job: {
        id: jobId,
        shotId: shotId,
        payload: { pipelineRunId: 'run-1', characterIds: [charId] }, // Payload takes precedence
      } as any,
      apiClient: mockApi,
    });

    if (!engineInvokedMeta?.identity) throw new Error('Identity metadata missing');
    if (engineInvokedMeta.identity.anchors[0].anchorId !== anchorId)
      throw new Error('Wrong anchor ID injected');
    console.log('[Test 1] ✅ Passed');

    // --- TEST 2: FAILURE CASE ---
    const charIdMissing = 'char-missing-' + Date.now();
    console.log('[Test 2] Expect Failure (Anchor missing)...');
    try {
      await processShotRenderJob({
        prisma: prismaProxy as any, // Proxy returns charId, but we override in Payload
        job: {
          id: jobId + '_fail',
          shotId: shotId,
          payload: { pipelineRunId: 'run-1', characterIds: [charIdMissing] },
        } as any,
        apiClient: mockApi,
      });
      throw new Error('Should have failed');
    } catch (e: any) {
      if (e.message.includes('IDENTITY_ANCHOR_MISSING')) {
        console.log('[Test 2] ✅ Passed (Caught expected error)');
      } else {
        throw e;
      }
    }

    console.log('[Gate] All Tests Passed');
  } catch (e) {
    console.error('[Gate] FAILED', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
