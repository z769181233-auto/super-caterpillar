import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Constants
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const USER_EMAIL = 'ad@test.com'; // Use admin user
const USER_PASSWORD = 'smoke-dev-password';

// Helpers
function log(msg: string) {
  console.log(`[VERIFY_STRUCTURE] ${msg}`);
}

function fail(msg: string) {
  console.error(`[VERIFY_STRUCTURE] FAIL: ${msg}`);
  process.exit(1);
}

const COOKIE_FILE = '/tmp/cookies.txt';

function login() {
  log('Logging in...');
  try {
    // -c to save cookies
    const res = execSync(`curl -s -X POST "${API_BASE_URL}/api/auth/login" \
      -H "Content-Type: application/json" \
      -c ${COOKIE_FILE} \
      -d '{"email":"${USER_EMAIL}","password":"${USER_PASSWORD}"}'`).toString();

    // Check if login successful (by response body or just assuming cookies set)
    // The response body is { success: true, ... }
    const json = JSON.parse(res);
    if (!json.success) {
      fail(`Login returned success: false: ${res}`);
    }

    // Verify cookie file exists and has content
    if (!fs.existsSync(COOKIE_FILE)) fail('Cookie file not created');
    log('Login successful (cookies saved).');
  } catch (e) {
    fail(`Login failed: ${e.message}`);
  }
}

function getProjectStructure(projectId: string) {
  log(`Fetching structure for project ${projectId}...`);
  try {
    // -b to use cookies
    const curlCmd = `curl -s -b ${COOKIE_FILE} "${API_BASE_URL}/api/projects/${projectId}/structure"`;
    // Increase maxBuffer to 50MB
    const res = execSync(curlCmd, { maxBuffer: 1024 * 1024 * 50 }).toString();

    // Check for 401
    if (res.includes('Unauthorized') || res.includes('"statusCode":401')) {
      fail(`API returned 401 Unauthorized. Cookies might be missing or invalid. Response: ${res}`);
    }

    log(`Response start: ${res.slice(0, 500)}...`);

    const json = JSON.parse(res);

    if (!json.success) {
      fail(`API returned success:false - ${JSON.stringify(json)}`);
    }
    return json.data;
  } catch (e) {
    fail(`Fetch failed: ${e.message}`);
  }
}

// Main
async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    fail('Usage: tsx verify_structure_data.ts <projectId>');
  }

  // 1. Auth
  login();

  // 2. Fetch
  const data = getProjectStructure(projectId);

  if (!data) fail('data is missing in response');

  log(`Data Keys: ${Object.keys(data).join(',')}`);

  // 3. Asset New Fields
  log('Verifying "tree" field...');
  if (!Array.isArray(data.tree)) fail(`data.tree is not an array (typeof ${typeof data.tree})`);
  if (data.tree.length === 0) log('WARN: tree is empty (maybe project analysis not done?)');
  else log(`Tree has ${data.tree.length} seasons.`);

  log('Verifying "counts" field...');
  if (!data.counts) fail('data.counts is missing');
  if (typeof data.counts.seasons !== 'number') fail('data.counts.seasons is not a number');
  log(`Counts: Seasons=${data.counts.seasons}, Episodes=${data.counts.episodes}`);

  log('Verifying "defaultSelection" field...');
  // It can be null if empty, but if tree > 0 it should be set
  if (data.tree.length > 0) {
    if (!data.defaultSelection) fail('data.defaultSelection should be set when tree is not empty');
    if (!data.defaultSelection.nodeId) fail('data.defaultSelection.nodeId missing');
    if (!data.defaultSelection.nodeType) fail('data.defaultSelection.nodeType missing');
    log(`Default Selection: ${data.defaultSelection.nodeType} ${data.defaultSelection.nodeId}`);
  } else {
    log('Tree empty, skipping defaultSelection check.');
  }

  log('Verifying "statusSummary" field...');
  if (!data.statusSummary) fail('data.statusSummary is missing');
  if (!['PENDING', 'ANALYZING', 'DONE', 'FAILED'].includes(data.statusSummary.analysis)) {
    fail(`Invalid statusSummary.analysis: ${data.statusSummary.analysis}`);
  }
  log(
    `Status Summary: Analysis=${data.statusSummary.analysis}, Render=${data.statusSummary.render}`
  );

  // Verify projectStatus
  if (!data.projectStatus) fail('data.projectStatus is missing (legacy compat)');
  log(`Project Status: ${data.projectStatus}`);

  log('SUCCESS: Structure API verified.');
}

main();
