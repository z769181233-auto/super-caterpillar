import { exec } from 'child_process';
import { writeFileSync, existsSync, unlinkSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// --- Configuration ---
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const EMAIL = process.env.AUTH_EMAIL || 'smoke_admin@scu.local';
// Using the password that matches the hash currently in init_api_key.ts
const PASSWORD = process.env.AUTH_PASSWORD || 'smoke-dev-password';
const TENANT_SLUG = 'smoke-tenant';
const TENANT_NAME = 'Smoke Tenant';

const STATE_FILE = path.resolve(__dirname, '.auth_state.json');
const ENV_FILE = path.resolve(__dirname, '.auth_env');

// --- Helpers ---

interface HttpResponse {
    code: number;
    headers: Record<string, string | string[]>;
    body: string;
    cookies: Record<string, string>;
    raw: string;
}

function parseCookies(header: string | string[] | undefined): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;

    const headers = Array.isArray(header) ? header : [header];
    headers.forEach(h => {
        // Set-Cookie: name=value; Path=/; HttpOnly...
        // We only care about name=value
        const parts = h.split(';');
        const kv = parts[0].split('=');
        if (kv.length >= 2) {
            cookies[kv[0].trim()] = kv.slice(1).join('=').trim();
        }
    });
    return cookies;
}

function formatCookieHeader(cookies: Record<string, string>): string {
    return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

function safeJsonParse(body: string, rawForDebug?: string): any {
    try {
        return JSON.parse(body);
    } catch (e) {
        console.error('[ensure_auth_state] JSON Parse Failed');
        if (rawForDebug) console.error(rawForDebug.substring(0, 1000)); // Print first 1000 chars of raw
        throw new Error('Failed to parse JSON response from API');
    }
}

function shellSingleQuote(v: string): string {
    // wrap with single quotes, escape existing single quotes safely for POSIX shell:
    // abc'def -> 'abc'"'"'def'
    return `'${v.replace(/'/g, `'\"'\"'`).replace(/\r?\n/g, '')}'`;
}

async function curl(method: string, endpoint: string, data?: any, currentCookies?: Record<string, string>): Promise<HttpResponse> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Concurrency Safety: Use unique temp directory
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'scu-smoke-auth-'));
    const headersFile = path.join(tmpDir, 'headers.txt');
    const bodyFile = path.join(tmpDir, 'body.txt');

    let cmd = `curl -sS -D "${headersFile}" -o "${bodyFile}" -w "%{http_code}" -X ${method}`;

    if (data) {
        const payloadFile = path.join(tmpDir, 'payload.json');
        writeFileSync(payloadFile, JSON.stringify(data), 'utf8');
        cmd += ` -H "Content-Type: application/json" --data-binary @"${payloadFile}"`;
    }

    if (currentCookies && Object.keys(currentCookies).length > 0) {
        cmd += ` -H "Cookie: ${formatCookieHeader(currentCookies)}"`;
    }

    cmd += ` "${url}"`;

    try {
        const { stdout } = await execAsync(cmd);
        const code = parseInt(stdout.trim(), 10);

        // Read files
        const rawHeadersAll = readFileSync(headersFile, 'utf8');
        const body = readFileSync(bodyFile, 'utf8');

        // Robust Header Parsing: Handle multiple blocks (100-continue, redirects)
        // Split into response blocks by "HTTP/" status line.
        const lines = rawHeadersAll.split(/\r?\n/);
        const startIdx: number[] = [];
        for (let i = 0; i < lines.length; i++) {
            if (/^HTTP\/\d(\.\d)?\s+\d{3}\b/i.test(lines[i])) startIdx.push(i);
        }

        // Build blocks
        let blocks: string[] = [];
        if (startIdx.length === 0) {
            blocks = [rawHeadersAll.trim()];
        } else {
            for (let j = 0; j < startIdx.length; j++) {
                const s = startIdx[j];
                const e = (j + 1 < startIdx.length) ? startIdx[j + 1] : lines.length;
                const b = lines.slice(s, e).join('\n').trim();
                if (b) blocks.push(b);
            }
        }

        // Prefer the last block that contains 'Set-Cookie', or fallback to the last block
        const activeBlock =
            [...blocks].reverse().find(b => /(^|\r?\n)set-cookie:/i.test(b)) ??
            blocks[blocks.length - 1] ??
            rawHeadersAll.trim();

        // Parse headers from the active block
        const headers: Record<string, string | string[]> = {};
        const setCookieLines: string[] = [];

        activeBlock.split(/\r?\n/).forEach((line) => {
            const idx = line.indexOf(':');
            if (idx <= 0) return;

            const key = line.slice(0, idx).trim().toLowerCase();
            if (!key) return;

            const value = line.slice(idx + 1).trim();

            if (key === 'set-cookie') setCookieLines.push(value);
            else headers[key] = value;
        });

        // Parse cookies from active block
        const newCookies = parseCookies(setCookieLines);

        // Merge with current cookies (new overwrites old)
        const finalCookies = { ...(currentCookies || {}), ...newCookies };

        return {
            code,
            headers,
            body,
            cookies: finalCookies,
            raw: `HTTP ${code}\n${activeBlock}\n\n${body.substring(0, 300)}...`
        };
    } catch (e: any) {
        throw new Error(`Curl failed: ${e.message}`);
    } finally {
        // Cleanup unique temp dir
        try {
            rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {
            // ignore cleanup errors
        }
    }
}

// --- Main ---

async function main() {
    console.log('[ensure_auth_state] Starting...');
    console.log(`[ensure_auth_state] Target: ${EMAIL} @ ${TENANT_SLUG}`);

    let cookies: Record<string, string> = {};
    let userId = '';
    let tenantId = '';

    // 1. Try Login
    console.log('[ensure_auth_state] Step 1: Login');
    let res = await curl('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });

    if (res.code !== 200 && res.code !== 201) {
        console.warn(`[ensure_auth_state] Login failed (HTTP ${res.code}). Attempting to reset/seed via init_api_key.ts...`);
        // Run init_api_key.ts to seed user
        try {
            // Pass SMOKE_USER_EMAIL and valid password hash implicitly via init script logic (assuming it uses defaults or we set them)
            // We know init_api_key.ts uses 'smoke@local' by default, but we want 'smoke_admin@scu.local'.
            // And we need the hash for 'smoke-dev-password'.
            // Based on previous step, we updated init_api_key.ts to use a specific hash for 'smoke-dev-password'.
            // We must override env vars to match our desired EMAIL if it differs from default.
            // previous init_api_key.ts default was 'smoke@local'. We want 'smoke_admin@scu.local'.

            const seedEnv = {
                ...process.env,
                SMOKE_USER_EMAIL: EMAIL,
                SMOKE_ORG_SLUG: TENANT_SLUG,
                SMOKE_ORG_NAME: TENANT_NAME,
                SMOKE_RESET: '1' // Force reset to ensure clean state
            };

            // Log env vars for debugging
            console.log(`[ensure_auth_state] Seeding with EMAIL=${EMAIL} DB=${process.env.DATABASE_URL?.substring(0, 15)}...`);

            // Use pnpm exec tsx for consistency
            const { stdout, stderr } = await execAsync('pnpm -w exec tsx tools/smoke/init_api_key.ts', { env: seedEnv });
            console.log('[ensure_auth_state] Seed Output:', stdout);
            if (stderr) console.error('[ensure_auth_state] Seed Errors:', stderr);

            console.log('[ensure_auth_state] Seed complete. Retrying Login...');

            res = await curl('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
        } catch (e: any) {
            console.error('[ensure_auth_state] Seed failed:', e.message);
            if (e.stdout) console.log('STDOUT:', e.stdout);
            if (e.stderr) console.error('STDERR:', e.stderr);
            process.exit(1);
        }
    }

    if (res.code !== 200 && res.code !== 201) {
        console.error('[ensure_auth_state] Login failed after retry.');
        console.error(res.raw);
        process.exit(1);
    }

    cookies = res.cookies;
    console.log('[ensure_auth_state] Login successful. Cookies:', Object.keys(cookies));

    // 2. Verify Me
    console.log('[ensure_auth_state] Step 2: Verify Me');
    res = await curl('GET', '/api/users/me', undefined, cookies);
    if (res.code !== 200) {
        console.error('[ensure_auth_state] Failed to get user info.');
        console.error(res.raw);
        process.exit(1);
    }

    const meBody = safeJsonParse(res.body, res.raw);
    userId = meBody.data.id;
    const userOrgs = meBody.data.organizations || [];

    if (!userId) {
        console.error('[ensure_auth_state] userId not found in response');
        process.exit(1);
    }

    // 3. Ensure Tenant
    console.log('[ensure_auth_state] Step 3: Ensure Tenant');
    let targetOrg = userOrgs.find((o: any) => o.slug === TENANT_SLUG);

    if (!targetOrg) {
        console.log('[ensure_auth_state] Tenant not in "me", checking list...');
        const listRes = await curl('GET', '/api/organizations', undefined, cookies);
        if (listRes.code === 200) {
            const listData = safeJsonParse(listRes.body, listRes.raw);
            const list = Array.isArray(listData.data) ? listData.data : [];
            targetOrg = list.find((o: any) => o.slug === TENANT_SLUG);
        }
    }

    if (!targetOrg) {
        console.log(`[ensure_auth_state] Tenant '${TENANT_SLUG}' not found in user list. Creating...`);
        res = await curl('POST', '/api/organizations', { name: TENANT_NAME, slug: TENANT_SLUG }, cookies);
        if (res.code !== 200 && res.code !== 201) {
            console.error('[ensure_auth_state] Failed to create organization.');
            console.error(res.raw);
            // It might strictly exist but user not in it? Unlikely with seed reset.
            process.exit(1);
        }
        const createBody = safeJsonParse(res.body, res.raw);
        targetOrg = createBody.data;
        // Cookies might update on creation? (unlikely but possible)
        cookies = res.cookies;
    }

    tenantId = targetOrg.id;
    console.log(`[ensure_auth_state] Tenant ID: ${tenantId}`);

    // 4. Switch Tenant
    console.log('[ensure_auth_state] Step 4: Switch Tenant');
    // Always switch to ensure cookies are minted for this org (especially if multi-tenant JWT claims are in play)
    res = await curl('POST', '/api/organizations/switch', { organizationId: tenantId }, cookies);
    if (res.code !== 200 && res.code !== 201) { // 201 is typical for POST, but Nest might return 200 or 201
        // User controller switch returns 201 usually?
        console.error('[ensure_auth_state] Failed to switch organization.');
        console.error(res.raw);
        process.exit(1);
    }

    // CRITICAL: Update cookies from switch response
    cookies = res.cookies;
    console.log('[ensure_auth_state] Switch successful. Cookies updated.');

    // 5. Final Verify
    console.log('[ensure_auth_state] Step 5: Final Verification');
    res = await curl('GET', '/api/users/me', undefined, cookies);
    const finalMe = safeJsonParse(res.body, res.raw);
    if (finalMe.data.currentOrganizationId !== tenantId) {
        console.warn(`[ensure_auth_state] WARNING: Current Org ID (${finalMe.data.currentOrganizationId}) != Target (${tenantId})`);
        // We persist anyway as the cookie should be valid, but warn.
    }

    // 6. Write Output
    const cookieHeader = formatCookieHeader(cookies);

    const state = {
        userId,
        tenantId,
        email: EMAIL,
        updatedAt: new Date().toISOString(),
        cookies,
        lastSwitchCode: res.code
    };

    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

    const cookieQ = shellSingleQuote(cookieHeader);
    const cookieHeaderQ = `Cookie: ${cookieHeader}`; // for header, still need safe double-quote
    const cookieHeaderEsc = cookieHeaderQ.replace(/"/g, '\\"').replace(/\r?\n/g, '');

    const envContent = [
        `export API_BASE_URL="${API_BASE_URL}"`,
        `export AUTH_COOKIE=${cookieQ}`,
        `export AUTH_COOKIE_HEADER="${cookieHeaderEsc}"`,
        `export AUTH_USER_ID="${userId}"`,
        `export AUTH_TENANT_ID="${tenantId}"`
    ].join('\n') + '\n';

    writeFileSync(ENV_FILE, envContent);

    try {
        await execAsync(`chmod 600 "${ENV_FILE}" "${STATE_FILE}"`);
    } catch {
        // ignore (e.g. Windows)
    }

    console.log('✅ Auth State Ready');
    console.log(`   User: ${userId}`);
    console.log(`   Tenant: ${tenantId}`);
    console.log(`   Cookie Length: ${cookieHeader.length}`);
}

main().catch(err => {
    console.error('❌ Fatal Error:', err);
    process.exit(1);
});
