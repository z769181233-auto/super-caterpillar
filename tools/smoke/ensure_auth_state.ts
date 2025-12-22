import { exec } from 'child_process';
import { writeFileSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// --- Configuration ---
let API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
// Standardize: Remove trailing slash and /api if we are going to add it manually in routes
API_BASE_URL = API_BASE_URL.replace(/\/$/, '');
if (API_BASE_URL.endsWith('/api')) {
  API_BASE_URL = API_BASE_URL.substring(0, API_BASE_URL.length - 4);
}

const EMAIL = process.env.AUTH_EMAIL || 'smoke@test.com';
const PASSWORD = process.env.AUTH_PASSWORD || 'smoke-dev-password';
const USER_EMAIL = 'smoke@test.com';
const TENANT_SLUG = 'smoke-tenant';
const TENANT_NAME = 'Smoke Tenant';

// --- Helpers ---

interface HttpResponse {
  code: number;
  headers: Record<string, string | string[]>;
  body: string;
  cookies: Record<string, string>;
}

function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  const headers = Array.isArray(header) ? header : [header];
  headers.forEach((h) => {
    const parts = h.split(';');
    const kv = parts[0].split('=');
    if (kv.length >= 2) {
      cookies[kv[0].trim()] = kv.slice(1).join('=').trim();
    }
  });
  return cookies;
}

async function curl(
  method: string,
  endpoint: string,
  data?: any,
  currentCookies?: Record<string, string>
): Promise<HttpResponse> {
  const url = `${API_BASE_URL}${endpoint}`;
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
    const cookieHeader = Object.entries(currentCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    cmd += ` -H "Cookie: ${cookieHeader}"`;
  }
  cmd += ` "${url}"`;

  try {
    const { stdout } = await execAsync(cmd);
    const code = parseInt(stdout.trim(), 10);
    const rawHeadersAll = readFileSync(headersFile, 'utf8');
    const body = readFileSync(bodyFile, 'utf8');

    const headers: Record<string, string | string[]> = {};
    const setCookieLines: string[] = [];
    rawHeadersAll.split(/\r?\n/).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx <= 0) return;
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (key === 'set-cookie') setCookieLines.push(value);
      else headers[key] = value;
    });

    const newCookies = parseCookies(setCookieLines);
    const finalCookies = { ...(currentCookies || {}), ...newCookies };

    return { code, headers, body, cookies: finalCookies };
  } catch (e: any) {
    throw new Error(`Curl failed: ${e.message}`);
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

/**
 * Stage 24 Requirement: Strictly 3 lines output. No file write. No ID/Ref.
 */
async function main() {
  let res = await curl('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });

  // Seed if needed (silent)
  if (res.code !== 200 && res.code !== 201) {
    try {
      const seedEnv = {
        ...process.env,
        SMOKE_USER_EMAIL: EMAIL,
        SMOKE_ORG_SLUG: TENANT_SLUG,
        SMOKE_ORG_NAME: TENANT_NAME,
        SMOKE_RESET: '1',
      };
      await execAsync('pnpm -w exec tsx tools/smoke/init_api_key.ts', { env: seedEnv });
      res = await curl('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
    } catch (e: any) {
      // Handle error silently or log non-sensitive error
    }
  }

  const cookies = res.cookies;
  const session_present = !!(cookies['accessToken'] || cookies['refreshToken']);
  const http_status = res.code;
  const redirected = res.code >= 300 && res.code < 400;

  // Strict Stage 24 Output
  console.log(`session_present=${session_present}`);
  console.log(`http_status=${http_status}`);
  console.log(`redirected=${redirected}`);
}

main().catch((err) => {
  // Fail silently to be compliant or log minimally
  process.exit(1);
});
