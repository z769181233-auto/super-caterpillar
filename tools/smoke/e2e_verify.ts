import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

const JOB_TYPE = 'NOVEL_ANALYSIS';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config();

import { PrismaClient } from 'database';
import { randomBytes } from 'crypto';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
// Use dynamic email to ensure strict isolation if not cleaning up
const E2E_USER_EMAIL = `e2e_auto_${randomBytes(4).toString('hex')}@scu.test`;
// Password hash was mocked in seed, but for login we need a password that matches the hash
const E2E_PASSWORD = 'Password123!';

const prisma = new PrismaClient();

// Helper for fetch wrapper
async function request(method: string, path: string, data?: any, token?: string) {
  const headers: any = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // console.log(`👉 ${method} ${path}`);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  // Parse cookie if present (for login/register)
  const setCookie = res.headers.get('set-cookie');
  let accessToken = null;
  if (setCookie) {
    const match = setCookie.match(/accessToken=([^;]+)/);
    if (match) accessToken = match[1];
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    json = null;
  }

  if (!res.ok) {
    const err: any = new Error(`Request failed: ${res.status} ${path}`);
    err.response = json;
    err.status = res.status;
    throw err;
  }

  return { data: json, accessToken };
}

async function main() {
  console.log('🚀 Starting E2E Vertical Slice Verification (RC1 - JWT Flow)...');
  console.log(`Target: ${API_BASE_URL}`);
  console.log(`User: ${E2E_USER_EMAIL}`);
  console.log(`DB URL: ${process.env.DATABASE_URL?.replace(/:[^:]+@/, ':***@')}`); // Hide pass

  try {
    // 1. Register User (Get Token)
    console.log('👤 Registering Test User...');
    const authRes = await request('POST', '/auth/register', {
      email: E2E_USER_EMAIL,
      password: E2E_PASSWORD,
      name: 'E2E Tester', // Add name if required
    });

    const token = authRes.accessToken;
    if (!token) throw new Error('Failed to get accessToken from cookie');
    const userId = authRes.data.data.user.id;
    console.log(`✅ Logged in. UserId=${userId}`);

    // Debug: Check if user exists in current DB connection
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(
        `❌ User ${userId} NOT FOUND in DB ${process.env.DATABASE_URL}. Connection mismatch!`
      );
    } else {
      console.log('✅ Verified User exists in DB.');
    }

    // 2. Setup/Find Project Data
    console.log('📦 Finding Seeded Project Data...');

    // Find the seeded project
    let project = await prisma.project.findFirst({
      where: { name: 'E2E Verify Project' },
    });

    let org;
    if (project) {
      console.log(`✅ Found Seeded Project: ${project.id}`);
      org = await prisma.organization.findUnique({ where: { id: project.organizationId } });

      // Add current test user to this Org/Project so we can access it via API
      await prisma.organizationMember.create({
        data: {
          organizationId: org!.id,
          userId: userId,
          role: 'OWNER',
        },
      });

      // Force Project Ownership to bypass strict checkOwnership() logic
      await prisma.project.update({
        where: { id: project.id },
        data: { ownerId: userId },
      });

      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: userId,
          roleId: (await prisma.role.findFirst({ where: { name: 'Owner' } }))!.id,
        },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { defaultOrganizationId: org!.id },
      });
    } else {
      console.log('⚠️ Seeded Project not found, creating new one...');
      // Fallback to creation if seed failed for some reason
      org = await prisma.organization.create({
        data: {
          name: 'E2E Org',
          ownerId: userId,
        },
      });
      project = await prisma.project.create({
        data: {
          name: `E2E Pj ${Date.now()}`,
          ownerId: userId,
          organizationId: org.id,
        },
      });
      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: userId,
          role: 'OWNER',
        },
      });
      await prisma.user.update({
        where: { id: userId },
        data: { defaultOrganizationId: org.id },
      });
    }

    if (!org || !project) throw new Error('Failed to setup project context');

    // Seed Project Membership (Bypass RBAC check) if we created it
    if (!project.organizationId) {
      // Should not happen with above logic, but for safety
      console.warn('Project has no Org ID?');
    }

    // Ensure we have a Shot to test with, and keep references for later tests
    let season;
    let episode;
    let scene;
    let shot;

    // Fix TS error: Shot does not have projectId. Use nested relation.
    shot = await prisma.shot.findFirst({
      where: { scene: { episode: { season: { projectId: project.id } } } },
    });

    if (!shot) {
      season =
        (await prisma.season.findFirst({ where: { projectId: project.id } })) ||
        (await prisma.season.create({ data: { projectId: project.id, index: 1, title: 'S1' } }));
      episode =
        (await prisma.episode.findFirst({ where: { seasonId: season.id } })) ||
        (await prisma.episode.create({ data: { seasonId: season.id, index: 1, name: 'E1' } }));
      scene = await prisma.scene.create({
        data: { episodeId: episode.id, index: 1, title: 'SC1', summary: 'Bypass Gate' },
      });
      shot = await prisma.shot.create({
        data: { sceneId: scene.id, index: 1, type: 'setup', params: {} },
      });
    } else {
      // Retrieve hierarchy if shot exists
      scene = await prisma.scene.findUnique({ where: { id: shot.sceneId } });
      episode = await prisma.episode.findUnique({ where: { id: scene!.episodeId } });
      season = await prisma.season.findUnique({ where: { id: episode!.seasonId } });
    }

    if (!season || !episode || !scene || !shot) throw new Error('Failed to resolve hierarchy');

    // Seed Engine
    const engine = await prisma.engine.upsert({
      where: { code: 'default_novel_analysis' },
      create: {
        code: 'default_novel_analysis',
        name: 'Default Novel Analysis',
        type: 'local',
        isActive: true,
        engineKey: 'default_novel_analysis',
        adapterName: 'default_novel_analysis',
        adapterType: 'local',
        config: {},
        enabled: true,
        versions: {
          create: {
            versionName: '1.0.0',
            config: {},
            enabled: true,
          },
        },
      },
      update: {
        isActive: true,
        enabled: true,
      },
    });

    // Seed Worker API Key for HMAC Auth
    const workerKey = process.env.WORKER_API_KEY;
    const workerSecret = process.env.WORKER_API_SECRET;
    if (workerKey && workerSecret) {
      console.log(`📦 Seeding Worker API Key: ${workerKey}`);
      await prisma.apiKey.upsert({
        where: { key: workerKey },
        create: {
          key: workerKey,
          secretHash: workerSecret, // Plain text per Minimal Version logic
          status: 'ACTIVE',
          ownerUserId: userId,
          ownerOrgId: org.id,
        },
        update: {
          secretHash: workerSecret,
          status: 'ACTIVE',
          ownerUserId: userId,
          ownerOrgId: org.id, // Re-bind to current E2E test context
        },
      });
    } else {
      console.warn(
        '⚠️ WORKER_API_KEY or WORKER_API_SECRET not found in env. Worker registration may fail.'
      );
    }

    console.log(`✅ Data Ready: Shot=${shot.id}, Member=${userId}, Engine & ApiKey seeded`);

    // Wait for DB propagation (safe guard)
    await new Promise((r) => setTimeout(r, 2000));

    // 3. RE-LOGIN to get Token with Organization Context
    console.log('🔄 Refreshing Token (Re-Login)...');
    const loginRes = await request('POST', '/auth/login', {
      email: E2E_USER_EMAIL,
      password: E2E_PASSWORD,
    });
    const newToken = loginRes.accessToken;
    if (!newToken) throw new Error('Failed to get refreshed accessToken');
    console.log('✅ Token Refreshed.');

    // 4. Test Fail Fast (API Validation)
    console.log('\n🧪 Test Case A: Fail Fast (API Validation Check)');

    // Create a DUMMY project WITHOUT NovelSource
    const failProject = await prisma.project.create({
      data: {
        name: `Expected Fail Pj ${Date.now()}`,
        ownerId: userId,
        organizationId: org.id,
      },
    });

    // Create Minimal Hierarchy to get a Shot ID (required for API endpoint)
    const fsRec = await prisma.season.create({
      data: { projectId: failProject.id, index: 1, title: 'FS1' },
    });
    const feRec = await prisma.episode.create({
      data: { seasonId: fsRec.id, index: 1, name: 'FE1' },
    });
    const fscRec = await prisma.scene.create({
      data: { episodeId: feRec.id, index: 1, title: 'FSC1', summary: 'Fail' },
    });
    const fshotRec = await prisma.shot.create({
      data: { sceneId: fscRec.id, index: 1, type: 'setup', params: {} },
    });

    console.log(`   Created dummy hierarchy for Fail Fast. ShotId: ${fshotRec.id}`);
    console.log(`   Attempting to create NOVEL_ANALYSIS job via API (Expected to fail)...`);

    try {
      await request(
        'POST',
        `/shots/${fshotRec.id}/jobs`,
        {
          type: 'NOVEL_ANALYSIS',
          payload: {},
        },
        newToken
      );
      throw new Error('❌ API did not reject invalid job! Expected 400.');
    } catch (err: any) {
      if (
        err.status === 400 &&
        err.response &&
        (JSON.stringify(err.response).includes('NOVEL_SOURCE_MISSING') ||
          err.message.includes('NOVEL_SOURCE_MISSING'))
      ) {
        console.log('✅ Fail Fast Case Passed (API correctly rejected with NOVEL_SOURCE_MISSING)');
      } else {
        throw new Error(
          `❌ API failed with unexpected error: ${err.message} ${JSON.stringify(err.response)}`
        );
      }
    }

    // 5. Happy Path
    console.log('\n🧪 Test Case B: Happy Path (Novel Import API)');
    const importRes = await request(
      'POST',
      `/projects/${project.id}/novel/import`,
      {
        title: 'Test Novel',
        rawText: 'Chapter 1: The Beginning.\nIt was a dark and stormy night.',
      },
      newToken
    );

    const jobIds = importRes.data.data.jobIds;
    if (!jobIds || jobIds.length === 0) throw new Error('No jobs returned from import');

    const happyJobId = jobIds[0];
    console.log(`   Job Created via API: ${happyJobId}`);
    await pollJob(happyJobId, newToken, 'SUCCEEDED'); // Requires worker running

    console.log('✅ Happy Path Passed');

    // 6. Assert Log Event Order (Defense against Regression)
    console.log('\n🔍 Verifying Log Event Order (CLAIMED < SUCCEEDED)...');
    const logPath = path.resolve(__dirname, '../../api.log');
    if (fs.existsSync(logPath)) {
      const logs = fs.readFileSync(logPath, 'utf8').split('\n');
      let claimedIdx = -1;
      let succeededIdx = -1;

      for (let i = 0; i < logs.length; i++) {
        const line = logs[i];
        if (line.includes('JOB_CLAIMED_SUCCESS') && line.includes(happyJobId)) {
          claimedIdx = i;
        }
        if (line.includes('JOB_SUCCEEDED') && line.includes(happyJobId)) {
          succeededIdx = i;
        }
      }

      if (claimedIdx === -1)
        console.warn(
          '⚠️ Could not find JOB_CLAIMED_SUCCESS in api.log (Might be rotated or missing)'
        );
      if (succeededIdx === -1) console.warn('⚠️ Could not find JOB_SUCCEEDED in api.log');

      if (claimedIdx !== -1 && succeededIdx !== -1) {
        if (claimedIdx < succeededIdx) {
          console.log(
            `✅ Log Order Verified: CLAIMED (L${claimedIdx}) -> SUCCEEDED (L${succeededIdx})`
          );
        } else {
          throw new Error(
            `❌ Log Order Violation! SUCCEEDED came before CLAIMED. This implies state machine regression.`
          );
        }
      }
    } else {
      console.warn(
        '⚠️ api.log not found, checking skipped. (Verify file path matches execution context)'
      );
    }

    console.log('\n🎉 E2E Verification Complete!');
  } catch (err: any) {
    console.error('❌ E2E Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function pollJob(jobId: string, token: string, targetStatus: string) {
  const maxRetries = 120; // 120s
  for (let i = 0; i < maxRetries; i++) {
    const res = await request('GET', `/jobs/${jobId}`, undefined, token);
    const job = res.data.data || res.data; // Handle potential wrapper

    if (i % 5 === 0)
      console.log(
        `   Poll ${i + 1}: ${job.status} Binding: ${JSON.stringify(job.engineBinding)} LastError: ${JSON.stringify(job.lastError)}`
      );

    if (job.status === targetStatus) {
      if (targetStatus === 'FAILED') {
        const errStr = JSON.stringify(job);
        if (
          errStr.includes('NO_SOURCE_TEXT') ||
          errStr.includes('未找到') ||
          errStr.includes('Novel source') ||
          errStr.includes('not found') ||
          (job.lastError &&
            (job.lastError.includes('NO_SOURCE_TEXT') ||
              job.lastError.includes('未找到') ||
              job.lastError.includes('Novel source')))
        ) {
          return;
        }
      } else {
        return;
      }
    }

    if (targetStatus === 'FAILED' && job.status === 'RETRYING') {
      if (job.lastError) {
        return;
      }
    }

    if (job.status === 'FAILED' && targetStatus !== 'FAILED') {
      throw new Error(`Job Failed: ${JSON.stringify(job.lastError || job.result)}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout polling ${jobId}`);
}

main();
