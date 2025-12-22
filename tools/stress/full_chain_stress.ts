/**
 * Full Chain Stress Test Suite (API Based)
 * 
 * Scenarios:
 * 1. Setup: Create User, Org, ApiKey, Project, NovelSource.
 * 2. RBAC: Ensure Admin User has Project Permissions (via ProjectMember).
 * 3. Client: Use API to trigger Novel Analysis (Creating Jobs).
 *    - Auth: JWT (User Context) + HMAC V2 (Signature Integrity).
 * 4. Worker: Mock workers consuming jobs via API.
 *    - Auth: HMAC V2 (Machine Context).
 * 5. Zombie Simulation: 20% workers die after claiming.
 * 6. Verify: Watchdog recovery.
 */

import axios from 'axios';
import { PrismaClient, JobStatus } from '../../packages/database';
import { randomUUID, createHmac, randomBytes, createHash } from 'crypto';

const API_URL = process.env.API_URL || 'http://localhost:3999';
const prisma = new PrismaClient();

// Configuration
const CONFIG = {
    TOTAL_CLIENTS: 5,
    JOBS_PER_CLIENT: 10,
    WORKER_THREADS: 5,
    ZOMBIE_RATE: 0.2,
    WATCHDOG_WAIT_MS: 15000,
};

const stats = {
    created: 0,
    claimed: 0,
    completed: 0,
    zombies: 0,
    recovered: 0,
    errors: 0
};

// --- HMAC Helpers (V2 Spec) ---
function generateNonce() { return randomBytes(16).toString('hex'); }
function computeBodyHash(body: any) {
    const str = body ? JSON.stringify(body) : '';
    return createHash('sha256').update(str).digest('hex');
}
function signRequest(method: string, path: string, body: any, apiKey: string, apiSecret: string) {
    const timestamp = Date.now().toString();
    const nonce = generateNonce();
    const contentHash = computeBodyHash(body);

    // V2 Canonical String
    // v2\nMETHOD\nPATH\nAPIKEY\nTIMESTAMP\nNONCE\nCONTENT_HASH\n
    const canonicalString = `v2\n${method.toUpperCase()}\n${path}\n${apiKey}\n${timestamp}\n${nonce}\n${contentHash}\n`;

    const signature = createHmac('sha256', apiSecret).update(canonicalString).digest('hex');

    return {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
        'X-Content-SHA256': contentHash,
        'X-Signature': signature
    };
}

// --- Setup Data ---
let masterUser: any;
let masterOrg: any;
let masterApiKey: any;
let masterRole: any;

async function setup() {
    console.log('[Setup] Creating test data...');
    const email = `stress_${randomUUID()}@test.com`;

    // Create User
    masterUser = await prisma.user.create({
        data: {
            email,
            passwordHash: 'hash',
            userType: 'admin',
            role: 'admin',
        }
    });

    // Create Org
    masterOrg = await prisma.organization.create({
        data: {
            name: 'Stress Org',
            ownerId: masterUser.id
        }
    });

    // Link Org Owner
    await prisma.organizationMember.create({
        data: { userId: masterUser.id, organizationId: masterOrg.id, role: 'OWNER' }
    });

    // Setup RBAC: Role & Permission
    let perm = await prisma.permission.findFirst({ where: { key: 'project.generate' } });
    if (!perm) {
        // Fallback if not seeded
        perm = await prisma.permission.create({
            data: { key: 'project.generate', scope: 'project' }
        });
    }

    masterRole = await prisma.role.create({
        data: {
            name: `StressRole_${randomUUID()}`,
            level: 100, // Arbitrary level
            rolePerms: {
                create: { permissionId: perm.id }
            }
        }
    });

    // Create Master API Key (Plain Secret storage for simplicity/test mode)
    const keyRec = await prisma.apiKey.create({
        data: {
            key: `stress-key-${randomUUID()}`,
            secretHash: 'stress-secret', // Treated as plain secret in test mode fallback
            status: 'ACTIVE',
            ownerOrgId: masterOrg.id,
            ownerUserId: masterUser.id // Link to user for ownership checks
        }
    });
    masterApiKey = { key: keyRec.key, secret: 'stress-secret' };
}

// --- Client ---
async function runClient(clientId: string) {
    try {
        // Create Project
        const project = await prisma.project.create({
            data: {
                name: `StressPro_${clientId}`,
                ownerId: masterUser.id,
                organizationId: masterOrg.id
            }
        });

        // Grant Project Permissions (RBAC) via ProjectMember
        await prisma.projectMember.create({
            data: {
                projectId: project.id,
                userId: masterUser.id,
                roleId: masterRole.id
            }
        });

        // Create NovelSource (Mock)
        await prisma.novelSource.create({
            data: {
                projectId: project.id,
                novelTitle: 'Stress Novel',
                rawText: 'Mock content',
            }
        });

        // JWT Token
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { sub: masterUser.id, email: masterUser.email, role: 'admin', orgId: masterOrg.id },
            process.env.JWT_SECRET || 'stress_test_secret_must_be_long_enough_32_chars'
        );

        // HMAC V2 Header Generation
        const { key, secret } = masterApiKey;

        for (let i = 0; i < CONFIG.JOBS_PER_CLIENT; i++) {
            const sigHeaders = signRequest('POST', `/api/projects/${project.id}/novel/analyze`, {}, key, secret);

            // Final Headers: JWT (Auth) + Signature (Integrity) + Context
            const headers = {
                ...sigHeaders,
                Authorization: `Bearer ${token}`,
                'x-organization-id': masterOrg.id
            };

            await axios.post(
                `${API_URL}/api/projects/${project.id}/novel/analyze`,
                {},
                { headers }
            );
            stats.created++;
        }

    } catch (e: any) {
        if (e.response?.status === 403) {
            console.error('[Client] 403 Forbidden:', JSON.stringify(e.response?.data));
        } else if (e.response?.status === 400) {
            console.error('[Client] 400 Bad Request:', JSON.stringify(e.response?.data));
        } else {
            console.error(`[Client] Error: ${e.message}`, e.response?.data);
        }
        stats.errors++;
    }
}

// --- Worker ---
async function runWorker(workerIndex: number) {
    const workerId = `worker_${workerIndex}_${randomUUID()}`;
    const { key, secret } = masterApiKey;

    const isZombie = Math.random() < CONFIG.ZOMBIE_RATE;

    try {
        // Worker uses PURE HMAC (Machine Auth) - No JWT
        // Claim Job
        const headers = signRequest('POST', `/api/workers/${workerId}/jobs/next`, {}, key, secret);
        const res = await axios.post(`${API_URL}/api/workers/${workerId}/jobs/next`, {}, { headers });

        const job = res.data?.data;
        if (!job) return;

        stats.claimed++;
        if (isZombie) {
            console.log(`[Worker ${workerIndex}] Zombie on Job ${job.id}`);
            stats.zombies++;
            return; // Die (Simulation)
        }

        // Processing Time
        await new Promise(r => setTimeout(r, 200));

        // Complete Job
        const completeHeaders = signRequest('POST', `/api/jobs/${job.id}/report`, { status: "SUCCEEDED" }, key, secret);
        await axios.post(`${API_URL}/api/jobs/${job.id}/report`, { status: "SUCCEEDED" }, { headers: completeHeaders });
        stats.completed++;
    } catch (e: any) {
        // Ignore expected errors (no jobs, etc)
        // console.error(`[Worker] Error: ${e.message}`);
    }
}

async function main() {
    console.log('=== Stress Test V2 (API) ===');
    await setup();

    // Run Clients
    const clients = Array.from({ length: CONFIG.TOTAL_CLIENTS }, (_, i) => runClient(i.toString()));
    await Promise.all(clients);
    console.log(`[Stats] Created ${stats.created} jobs.`);

    // Run Workers
    const startTime = Date.now();
    let keepRunning = true;
    // Start workers
    const workers = Array.from({ length: CONFIG.WORKER_THREADS }, (_, i) => (async () => {
        while (keepRunning) {
            await runWorker(i);
            await new Promise(r => setTimeout(r, 100));
        }
    })());

    // Run for 8 seconds
    await new Promise(r => setTimeout(r, 8000));
    keepRunning = false;
    await Promise.all(workers);

    // Verify
    console.log('=== Verification ===');
    console.log(`Zombies created: ${stats.zombies}`);
    console.log(`Waiting for Watchdog (${CONFIG.WATCHDOG_WAIT_MS}ms)...`);
    await new Promise(r => setTimeout(r, CONFIG.WATCHDOG_WAIT_MS));

    const stuck = await prisma.shotJob.count({
        where: { status: 'RUNNING', updatedAt: { lt: new Date(Date.now() - 5000) } }
    });

    console.log(`Stuck Jobs: ${stuck}`);
    if (stuck === 0 && stats.zombies > 0) {
        console.log('✅ PASS: Watchdog cleaned up.');
    } else if (stuck > 0) {
        console.log('❌ FAIL: Zombies remain.');
        process.exit(1);
    } else {
        console.log('⚠️ INCONCLUSIVE');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
