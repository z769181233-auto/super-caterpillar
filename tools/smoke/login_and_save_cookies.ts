import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const EMAIL = 'ad@test.com';
const PASSWORD = 'smoke-dev-password';
const COOKIE_FILE = path.join(__dirname, '.cookies.txt');

function fail(msg: string) {
  console.error(`[LOGIN] FAIL: ${msg}`);
  process.exit(1);
}

function main() {
  console.log(`[LOGIN] Logging in as ${EMAIL}...`);

  // Use curl with cookie-jar
  const cmd = `curl -c "${COOKIE_FILE}" -X POST "${API_BASE}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '${JSON.stringify({ email: EMAIL, password: PASSWORD })}' -s`;

  try {
    const res = execSync(cmd).toString();
    const json = JSON.parse(res);

    // Fix for nested response: { success: true, data: { user: ... } }
    const user = json.data?.user || json.user;
    const token = json.data?.accessToken || json.accessToken;

    if (token || (user && user.id)) {
      console.log(`[LOGIN] Success. Cookies saved to ${COOKIE_FILE}`);
      if (token) {
        fs.writeFileSync(path.join(__dirname, '.token'), token);
        console.log(`[LOGIN] Token saved to .token`);
      }
      // Also save Bearer token if needed, but cookies are sufficient for stateful auth usually.
      // If API expects Bearer, we might need to export it.
      // But verify_structure_contract.ts uses -b cookie_file, so we are good.
    } else {
      console.error('[LOGIN] Response:', res);
      fail('Login failed (no token/user in response)');
    }
  } catch (e: any) {
    fail(`Login curl failed: ${e.message}`);
  }
}

main();
