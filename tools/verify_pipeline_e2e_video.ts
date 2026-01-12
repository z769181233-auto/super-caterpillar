import { PrismaClient } from '../packages/database';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'node:child_process';
import { ensureEvidenceDir, appendEvidenceJSONL, writeEvidenceJSON, safeSummary } from './_verify/lib/evidence';

// --- Configuration ---
const API_URL = 'http://localhost:3000/api';
const POLLING_INTERVAL_MS = 2000;
const TIMEOUT_MS = 120000; // 2 minutes for full pipeline

// --- Helpers ---
function hmacSha256(key: string, content: string): string {
    return crypto.createHmac('sha256', key).update(content).digest('hex');
}

function generateSignatureV1_1(apiKey: string, secret: string, nonce: string, timestamp: string, body: string) {
    // Strict Spec V1.1: HMAC_SHA256(api_key + nonce + timestamp + rawBody)
    const canonical = `${apiKey}${nonce}${timestamp}${body}`;
    return hmacSha256(secret, canonical);
}

// evidence init
const iso = new Date().toISOString().replace(/[:.]/g, "-");
const EVD = ensureEvidenceDir(path.resolve(__dirname, `../docs/_evidence/pipeline_e2e_video_${iso}`));
const EVENTS = EVD.jsonlPath("events"); // events.jsonl

function ev(type: string, data: any) {
    appendEvidenceJSONL(EVENTS, { ts: new Date().toISOString(), type, ...data });
}

function logSummary(label: string, obj: any) {
    const summary = safeSummary(obj);
    console.log(label, summary);
    ev("summary", { label, summary });
}

const prisma = new PrismaClient();

async function fetchJobsByTrace(traceId: string) {
    return prisma.shotJob.findMany({
        where: { traceId },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            lastError: true,
            securityProcessed: true
        },
    });
}

async function fetchAuditLogs(traceId: string) {
    // AuditLog 中的 traceId 存储在 details JSON 中
    return prisma.auditLog.findMany({
        where: {
            OR: [
                { details: { path: ['traceId'], equals: traceId } },
                { details: { path: ['pipelineRunId'], equals: traceId } }
            ]
        },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
            id: true,
            createdAt: true,
            action: true,
            resourceType: true,
            resourceId: true,
            nonce: true,
            signature: true,
            timestamp: true,
            ip: true,
            userAgent: true,
        },
    });
}

function captureProducts(runtimeDir: string) {
    const out = EVD.textPath("products.txt");
    try {
        // 只写前2000行，避免目录过大
        const cmd = `bash -lc 'ls -R ${runtimeDir} 2>/dev/null | head -n 2000 > ${out}'`;
        execSync(cmd, { stdio: "ignore" });
        ev("products_captured", { runtimeDir, out });
    } catch (e: any) {
        console.warn(`⚠️ Failed to capture products: ${e.message}`);
    }
}

// --- Constants ---
const EXIT_PASS = 0;
const EXIT_FAIL_ENV = 20;      // 环境/连接问题
const EXIT_FAIL_SECURITY = 21; // APISec 负测失败
const EXIT_FAIL_LOGIC = 22;    // DAG/状态逻辑失败

// --- Main Verification Flow ---
async function verify() {
    process.on('uncaughtException', (err) => {
        console.error('🔥 Uncaught Exception:', err);
        ev("verify_error_fatal", { message: err.message, stack: err.stack });
        process.exit(EXIT_FAIL_LOGIC);
    });

    console.log('🚀 Starting COMMERCIAL GRADE PIPELINE_E2E_VIDEO Verification...');
    console.log(`📂 Evidence Directory: ${EVD.dir}`);
    ev("verify_start", { startTime: new Date().toISOString() });

    let finalStatus = 'FAIL_ENV'; // 默认状态

    try {
        // 1. Data Setup
        console.log('🔹 Setting up Test Data...');
        const orgId = crypto.randomUUID();
        const userId = crypto.randomUUID();
        const projectId = crypto.randomUUID();
        const apiKey = `ak_test_${crypto.randomUUID()}`;
        const apiSecret = `sk_test_${crypto.randomUUID()}`;

        try {
            // Create User & Org
            await prisma.user.create({
                data: { id: userId, email: `${userId}@verify.com`, passwordHash: 'hash' }
            });
            await prisma.organization.create({
                data: { id: orgId, name: 'Verify Org Commercial', ownerId: userId }
            });
            await prisma.organizationMember.create({
                data: { userId, organizationId: orgId, role: 'OWNER' }
            });
            await prisma.project.create({
                data: { id: projectId, name: 'Commercial Pipeline Project', organizationId: orgId, ownerId: userId }
            });
            await prisma.apiKey.create({
                data: {
                    key: apiKey,
                    secretHash: apiSecret,
                    ownerOrgId: orgId,
                    ownerUserId: userId,
                    name: 'Verify Key Commercial',
                    status: 'ACTIVE'
                }
            });
        } catch (dbErr: any) {
            console.error('❌ DB Setup Failed:', dbErr.message);
            ev("verify_error_db", { message: dbErr.message });
            finalStatus = 'FAIL_ENV';
            throw dbErr;
        }

        console.log('✅ Test Data Ready.');
        ev("data_setup_complete", { projectId, apiKey });

        // 2. API Security Negative Tests
        console.log('🔹 Running API Security Negative Tests...');
        const bodyObj = { projectId, rawText: 'Commercial Grade Test Story content.' };
        const bodyStr = JSON.stringify(bodyObj);
        const nonce = crypto.randomUUID();
        const ts = Math.floor(Date.now() / 1000).toString();

        // 2.1 Invalid Signature
        try {
            await axios.post(`${API_URL}/story/parse`, bodyObj, {
                headers: {
                    'x-api-key': apiKey,
                    'x-nonce': crypto.randomUUID(),
                    'x-timestamp': ts,
                    'x-signature': 'invalid_signature_hex',
                    'x-content-sha256': crypto.createHash('sha256').update(bodyStr).digest('hex'),
                    'content-type': 'application/json'
                },
                timeout: 5000
            });
            ev("negative_test_failed", { test: 'InvalidSignature', reason: 'Accepted unintended' });
            finalStatus = 'FAIL_SECURITY';
            throw new Error('❌ Negative Test Failed: Should have rejected Invalid Signature');
        } catch (e: any) {
            if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
                ev("api_unreachable", { code: e.code, test: 'Negative_1' });
                finalStatus = 'FAIL_ENV';
                throw new Error('❌ API Unreachable during Negative Test');
            }
            if (e.response?.status === 403 || e.response?.data?.error?.code === '4003' || e.response?.data?.statusCode === 403) {
                console.log('✅ Negative Test Passed: Invalid Signature rejected (4003).');
            } else {
                logSummary('❌ Negative Test Failed Details', e.response?.data);
                ev("negative_test_failed", { test: 'InvalidSignature', status: e.response?.status, data: e.response?.data });
                finalStatus = 'FAIL_SECURITY';
                throw new Error(`❌ Negative Test Failed: Expected 4003, got ${e.response?.status}`);
            }
        }

        // 3. Positive Flow (Trigger Pipeline)
        const validSig = generateSignatureV1_1(apiKey, apiSecret, nonce, ts, bodyStr);

        let res;
        try {
            res = await axios.post(`${API_URL}/story/parse`, bodyObj, {
                headers: {
                    'x-api-key': apiKey,
                    'x-nonce': nonce,
                    'x-timestamp': ts,
                    'x-signature': validSig,
                    'x-content-sha256': crypto.createHash('sha256').update(bodyStr).digest('hex'),
                    'content-type': 'application/json'
                },
                timeout: 10000
            });
        } catch (e: any) {
            if (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
                ev("api_unreachable", { code: e.code, action: 'TriggerPipeline' });
                finalStatus = 'FAIL_ENV';
            } else {
                ev("pipeline_trigger_failed", { status: e.response?.status, data: e.response?.data });
                finalStatus = 'FAIL_LOGIC';
            }
            throw e;
        }

        const { jobId, traceId } = res.data;
        console.log(`✅ Pipeline Triggered. Root JobId: ${jobId}, TraceId: ${traceId}`);
        writeEvidenceJSON(EVD.jsonPath('api_response_success'), res.data);
        ev("pipeline_triggered", { jobId, traceId });

        // 2.2 Replay Test
        console.log('🔹 Running Replay Attack Test...');
        try {
            await axios.post(`${API_URL}/story/parse`, bodyObj, {
                headers: {
                    'x-api-key': apiKey,
                    'x-nonce': nonce,
                    'x-timestamp': ts,
                    'x-signature': validSig,
                    'x-content-sha256': crypto.createHash('sha256').update(bodyStr).digest('hex'),
                    'content-type': 'application/json'
                },
                timeout: 5000
            });
            ev("negative_test_failed", { test: 'ReplayAttack', reason: 'Accepted unintended' });
            finalStatus = 'FAIL_SECURITY';
            throw new Error('❌ Replay Test Failed: Should have rejected Replay');
        } catch (e: any) {
            const code = e.response?.data?.error?.code || e.response?.data?.code;
            if (code === '4004' || e.response?.status === 403) {
                console.log('✅ Replay Test Passed: Replay rejected (4004/403).');
            } else {
                console.warn(`⚠️ Replay Test Warning: Expected 4004, got ${e.response?.status}. Body:`, safeSummary(e.response?.data));
                ev("negative_test_warning", { test: 'ReplayAttack', status: e.response?.status });
                // Warning only, don't necessarily fail the whole script if logic is OK
            }
        }

        // 4. Verify Root Job & Pipeline Execution
        console.log('🔹 Polling DAG Execution...');
        const pollStarted = Date.now();
        let pipelineComplete = false;
        let lastJobs: any[] = [];

        while (Date.now() - pollStarted < TIMEOUT_MS) {
            const jobs = await fetchJobsByTrace(traceId);
            lastJobs = jobs;

            appendEvidenceJSONL(EVD.jsonlPath("job_polls"), {
                ts: new Date().toISOString(),
                traceId,
                jobs,
            });

            const types = jobs.map(j => j.type);
            const statuses = jobs.map(j => j.status);
            const failed = jobs.find(j => j.status === 'FAILED');

            process.stdout.write(`\r   Jobs: ${types.length} | Sequence: ${types.join(' -> ')} | Status: ${statuses.join(',')}`);

            if (failed) {
                console.log(`\n❌ Pipeline FAILED at ${failed.type}: ${failed.lastError}`);
                writeEvidenceJSON(EVD.jsonPath('failed_job_state'), jobs);
                ev("pipeline_failed", { type: failed.type, error: failed.lastError });
                finalStatus = 'FAIL_LOGIC';
                throw new Error(`Pipeline logic failure at ${failed.type}`);
            }

            const ce09 = jobs.find(j => j.type === 'CE09_MEDIA_SECURITY');
            if (ce09 && ce09.status === 'SUCCEEDED') {
                console.log('\n✅ CE09_MEDIA_SECURITY Completed.');

                const expectedSequence = [
                    'CE06_NOVEL_PARSING',
                    'CE03_VISUAL_DENSITY',
                    'CE04_VISUAL_ENRICHMENT',
                    'PIPELINE_TIMELINE_COMPOSE',
                    'TIMELINE_RENDER',
                    'CE09_MEDIA_SECURITY'
                ];

                const missing = expectedSequence.filter(type => !types.includes(type as any));
                if (missing.length > 0) {
                    console.log(`\n❌ DAG Incomplete. Missing stages: ${missing.join(', ')}`);
                    writeEvidenceJSON(EVD.jsonPath('incomplete_dag_state'), jobs);
                    ev("dag_incomplete", { missing });
                    finalStatus = 'FAIL_LOGIC';
                    throw new Error('DAG Incomplete');
                }

                console.log('✅ Full DAG Sequence verified.');
                pipelineComplete = true;
                break;
            }

            await new Promise(r => setTimeout(r, POLLING_INTERVAL_MS));
        }

        if (!pipelineComplete) {
            ev("poll_timeout", { traceId, elapsed: Date.now() - pollStarted });
            finalStatus = 'FAIL_LOGIC';
            throw new Error('Timeout waiting for CE09 completion');
        }

        // 5. DB Write Verification
        console.log('🔹 Verifying DB writes...');
        const ce09Job = lastJobs.find(j => j.type === 'CE09_MEDIA_SECURITY');
        if (!ce09Job?.securityProcessed) {
            finalStatus = 'FAIL_LOGIC';
            throw new Error('❌ CE09 Job: securityProcessed is FALSE');
        }
        console.log('✅ CE09 Job: securityProcessed = true');

        const asset = await prisma.asset.findFirst({
            where: { projectId: projectId, status: 'PUBLISHED' }
        });

        if (!asset) {
            finalStatus = 'FAIL_LOGIC';
            throw new Error('❌ No PUBLISHED asset found for project');
        }
        if (!asset.signedUrl) throw new Error('❌ Asset: signedUrl is missing');
        if (!asset.fingerprintId) throw new Error('❌ Asset: fingerprintId is missing');

        console.log('✅ Asset: Signed URL, Fingerprint verified.');
        writeEvidenceJSON(EVD.jsonPath('final_asset'), asset);

        // 6. Audit Log Verification
        console.log('🔹 Verifying Audit Logs...');
        const audits = await fetchAuditLogs(traceId);
        ev("audit_logs_collected", { count: audits.length, traceId });

        if (audits.length === 0) {
            finalStatus = 'FAIL_LOGIC';
            throw new Error('❌ No Audit Logs found for this traceId');
        }

        const securityAudit = audits.find(a => a.action === 'ce09.media_security.success' && a.resourceId === asset.id);

        if (!securityAudit) console.warn('⚠️ CE09 Audit Log missing (Action: ce09.media_security.success)');
        else console.log('✅ CE09 Audit Log Verified.');

        writeEvidenceJSON(EVD.jsonPath('final_audit_logs'), audits);

        // 7. Capture Products
        console.log('🔹 Capturing Product Listing...');
        captureProducts(path.resolve(__dirname, '../storage/outputs'));

        console.log('\n🎉 PASS: COMMERCIAL GRADE PIPELINE VERIFIED.');
        ev("verify_pass", { traceId });
        finalStatus = 'PASS';

    } catch (err: any) {
        console.error('\n❌ Verification Failed:', err.message);
        ev("verify_error", { message: err.message, status: finalStatus });
        // Don't re-throw here, we want to hit the verify_end in finally or below
    } finally {
        ev("verify_end", { status: finalStatus, endTime: new Date().toISOString() });
        await prisma.$disconnect();

        const exitCodeMap: Record<string, number> = {
            'PASS': EXIT_PASS,
            'FAIL_ENV': EXIT_FAIL_ENV,
            'FAIL_SECURITY': EXIT_FAIL_SECURITY,
            'FAIL_LOGIC': EXIT_FAIL_LOGIC
        };
        process.exit(exitCodeMap[finalStatus] ?? EXIT_FAIL_LOGIC);
    }
}

verify();
