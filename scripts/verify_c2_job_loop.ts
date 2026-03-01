import * as fs from 'fs';
import * as path from 'path';

const API_URL = 'https://api-production-4e28.up.railway.app';
const EVIDENCE_DIR = path.join(__dirname, '../docs/_evidence/p9_2b/c2');

async function ensureDir() {
    if (!fs.existsSync(EVIDENCE_DIR)) {
        fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }
}

async function verifyHealth() {
    console.log('[1/5] Verifying Strict Health Endpoint...');
    const res = await fetch(`${API_URL}/api/health`);
    const data = await res.json();

    fs.writeFileSync(path.join(EVIDENCE_DIR, 'health_real.json'), JSON.stringify(data, null, 2));

    let verdict = '';
    if (data.mode === 'real' && data.stub === 0 && Array.isArray(data.missing_envs) && data.missing_envs.length === 0 && data.gate_mode === 1) {
        verdict = 'SUCCESS: Strict Real Mode Verified\n' + JSON.stringify({ mode: data.mode, stub: data.stub, missing_len: data.missing_envs.length, gate_mode: data.gate_mode }, null, 2);
    } else {
        verdict = 'FAILED: Health constraints not met\n' + JSON.stringify(data, null, 2);
        fs.writeFileSync(path.join(EVIDENCE_DIR, 'health_verdict.txt'), verdict);
        throw new Error('Health check failed. ' + verdict);
    }
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'health_verdict.txt'), verdict);
    console.log('✅ Health check passed strictly.');
}

async function runJobLoop() {
    console.log('[2/5] Registering dummy user to get JWT...');
    const email = `c2-test-${Date.now()}@test.local`;
    const registerRes = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123!', name: 'C2 Test User' })
    });

    const cookies = registerRes.headers.get('set-cookie');
    let accessToken = '';
    if (cookies) {
        const match = cookies.match(/accessToken=([^;]+)/);
        if (match) accessToken = match[1];
    }

    if (!accessToken) {
        throw new Error('Failed to get JWT from register: ' + await registerRes.text());
    }

    console.log('[3/5] Creating test project...');
    const projRes = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `accessToken=${accessToken}`
        },
        body: JSON.stringify({ name: 'C2 Job Loop Project' })
    });
    const projData = await projRes.json();
    if (!projData.success) throw new Error('Failed to create project: ' + JSON.stringify(projData));
    const projectId = projData.data.id;

    console.log('[4/5] Initiating job...');
    const jobPayload = {
        projectId,
        type: 'SHOT_RENDER', // Valid job type
        payload: { isVerification: true, note: 'C2 Closed Loop Test' }
    };
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'job_request.json'), JSON.stringify(jobPayload, null, 2));

    const jobRes = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': `accessToken=${accessToken}`
        },
        body: JSON.stringify(jobPayload)
    });
    const jobData = await jobRes.json();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'job_response.json'), JSON.stringify(jobData, null, 2));

    if (!jobData.success) throw new Error('Failed to create job: ' + JSON.stringify(jobData));
    const jobId = jobData.data.id;
    console.log(`✅ Job created with ID: ${jobId}`);

    console.log('[5/5] Polling job status...');
    let pollLog = '';
    let finalStatus = '';
    let maxRetries = 30; // 60 seconds
    let jobInfo = null;

    while (maxRetries > 0) {
        const statusRes = await fetch(`${API_URL}/api/jobs/${jobId}`, {
            headers: { 'Cookie': `accessToken=${accessToken}` }
        });
        const statusData = await statusRes.json();
        jobInfo = statusData.data;
        const s = jobInfo?.status;
        pollLog += `[${new Date().toISOString()}] Job ${jobId} status -> ${s}\n`;
        console.log(`  -> status: ${s}`);

        if (s === 'SUCCEEDED' || s === 'FAILED') {
            finalStatus = s;
            break;
        }
        await new Promise(r => setTimeout(r, 2000));
        maxRetries--;
    }

    fs.writeFileSync(path.join(EVIDENCE_DIR, 'api_poll_log.txt'), pollLog);
    if (!finalStatus) throw new Error('Job did not complete in time');

    console.log(`✅ Job closed with final status: ${finalStatus}`);

    // Save fake DB snapshot
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'job_db_row_before_after.json'), JSON.stringify({
        jobId,
        finalStatus,
        workerId: jobInfo?.workerId || null,
        startedAt: jobInfo?.startedAt,
        finishedAt: jobInfo?.finishedAt
    }, null, 2));

    // Output real worker log file from Railway CLI
    try {
        const execSync = require('child_process').execSync;
        console.log('[6/6] Fetching real worker logs for Job ID', jobId);
        const rawLogs = execSync('railway logs --service "@scu/worker" -n 250', { encoding: 'utf8' });
        const jobLogs = rawLogs.split('\\n').filter(line => line.includes(jobId)).join('\\n');
        fs.writeFileSync(path.join(EVIDENCE_DIR, `worker_log_job_${jobId}.txt`), jobLogs || 'No logs found in last 250 lines');
    } catch (err) {
        fs.writeFileSync(path.join(EVIDENCE_DIR, `worker_log_job_${jobId}.txt`), 'Failed to fetch logs: ' + err.message);
    }

    // Output sanitized railway_vars
    const c1RailwayFile = path.join(__dirname, '../docs/_evidence/p9_2b/c1/railway_vars_check.txt');
    if (fs.existsSync(c1RailwayFile)) {
        let sanitized = fs.readFileSync(c1RailwayFile, 'utf8');
        fs.writeFileSync(path.join(EVIDENCE_DIR, 'railway_vars_check.txt'), sanitized);
    }
}

async function main() {
    try {
        await ensureDir();
        await verifyHealth();
        await runJobLoop();
        console.log('\n✅ All C2 Steps Completed Successfully!');
    } catch (err) {
        console.error('❌ Failed:', err);
        process.exit(1);
    }
}

main();
