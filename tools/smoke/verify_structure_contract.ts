import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
// Default cookie file from ensure_auth_state.ts
const COOKIE_FILE = process.env.COOKIE_FILE || path.join(__dirname, '.cookies.txt');
const TOKEN_FILE = path.join(__dirname, '.token');
const AUTH_HEADER = process.env.AUTH_COOKIE_HEADER;

function fail(msg: string) {
  console.error(`[VERIFY_CONTRACT] FAIL: ${msg}`);
  process.exit(1);
}

function log(msg: string) {
  console.log(`[VERIFY_CONTRACT] ${msg}`);
}

function fetchApi(url: string) {
  let curlCmd = `curl -s -b "${COOKIE_FILE}" "${API_BASE}${url}"`;

  // Prefer Auth Header if available (run_all.sh integration)
  if (AUTH_HEADER) {
    curlCmd = `curl -s -H "${AUTH_HEADER}" "${API_BASE}${url}"`;
  } else if (fs.existsSync(TOKEN_FILE)) {
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    curlCmd = `curl -s -b "${COOKIE_FILE}" -H "Authorization: Bearer ${token}" "${API_BASE}${url}"`;
  }

  try {
    const res = execSync(curlCmd, { maxBuffer: 10 * 1024 * 1024 }).toString();
    const json = JSON.parse(res);
    if (!json.success && !Array.isArray(json)) {
      if (json.statusCode && json.statusCode >= 400) {
        throw new Error(`API Error: ${json.statusCode} ${json.message}`);
      }
    }
    return json.data || json; // Handle both wrapped and unwrapped
  } catch (e: any) {
    fail(`Fetch ${url} failed: ${e.message}`);
    return null;
  }
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId) fail('Usage: tsx verify_structure_contract.ts <projectId>');

  log(`Target Project: ${projectId}`);

  if (!AUTH_HEADER && !fs.existsSync(COOKIE_FILE)) {
    fail(`Auth missing: set AUTH_COOKIE_HEADER or ensure ${COOKIE_FILE} exists`);
  }

  // 1. GET /structure
  log('Checking GET /structure...');
  const structure = fetchApi(`/api/projects/${projectId}/structure`);
  if (!structure) fail('Structure response empty');

  // Validate Fields
  if (!Array.isArray(structure.tree)) {
    console.log('[DEBUG] Structure Response:', JSON.stringify(structure, null, 2));
    fail('structure.tree is not array');
  }
  if (!structure.counts) fail('structure.counts missing');
  if (!structure.statusSummary) fail('structure.statusSummary missing');

  // Validate Counts (Expect 1 Season, 2 Episodes, 6 Scenes, 30 Shots)
  const { seasons, episodes, scenes, shots } = structure.counts;
  log(`Counts: Se=${seasons}, Ep=${episodes}, Sc=${scenes}, Sh=${shots}`);

  if (seasons !== 1) fail(`Expected 1 Season, got ${seasons}`);
  if (episodes !== 2) fail(`Expected 2 Episodes, got ${episodes}`);
  if (scenes !== 6) fail(`Expected 6 Scenes, got ${scenes}`);
  if (shots !== 30) fail(`Expected 30 Shots, got ${shots}`);

  // 2. Validate GET /seasons
  log('Checking GET /seasons...');
  const seasonsList = fetchApi(`/api/projects/${projectId}/seasons`);
  if (!Array.isArray(seasonsList)) fail('Seasons list is not array');
  if (seasonsList.length !== 1) fail(`Expected 1 season in list, got ${seasonsList.length}`);
  const seasonId = seasonsList[0].id;

  // 3. Validate GET /episodes?seasonId=...
  log(`Checking GET /episodes?seasonId=${seasonId}...`);
  const epRes = fetchApi(`/api/projects/${projectId}/episodes?seasonId=${seasonId}`);
  // ProjectController.listEpisodes returns { data: [], total: ... } inside data

  const episodesList = epRes;
  if (!Array.isArray(episodesList.data)) {
    fail(`Episodes list format invalid (expected .data array): ${JSON.stringify(epRes)}`);
  }
  const actualEps = episodesList.data;
  if (actualEps.length !== 2) fail(`Expected 2 episodes, got ${actualEps.length}`);
  const episodeId = actualEps[0].id;

  // 4. Validate GET /scenes?episodeId=...
  log(`Checking GET /scenes?episodeId=${episodeId}...`);
  const scRes = fetchApi(`/api/projects/${projectId}/scenes?episodeId=${episodeId}`);
  if (!scRes.data || !Array.isArray(scRes.data))
    fail(`Scenes list format invalid: ${JSON.stringify(scRes)}`);
  const actualScenes = scRes.data;
  if (actualScenes.length !== 3) fail(`Expected 3 scenes, got ${actualScenes.length}`);
  const sceneId = actualScenes[0].id;

  // 5. Validate GET /shots?sceneId=...
  log(`Checking GET /shots?sceneId=${sceneId}...`);
  const shRes = fetchApi(`/api/projects/${projectId}/shots?sceneId=${sceneId}`);
  const actualShots = shRes.shots;
  if (!Array.isArray(actualShots)) fail(`Shots list format invalid: ${JSON.stringify(shRes)}`);
  if (actualShots.length !== 5) fail(`Expected 5 shots, got ${actualShots.length}`);

  // ========== HARD GATES (Task 2: Smoke Gate Hardening) ==========

  // Hard Gate 1: Counts must ALL be non-zero
  log('🔒 HARD GATE 1: Counts non-zero validation');
  if (seasons === 0 || episodes === 0 || scenes === 0 || shots === 0) {
    fail(
      `❌ GATE FAILED: At least one count is 0. Se=${seasons}, Ep=${episodes}, Sc=${scenes}, Sh=${shots}`
    );
  }
  log('✅ GATE 1 PASSED: All counts > 0');

  // Hard Gate 2: Tree depth must be exactly 4 (Season → Episode → Scene → Shot)
  log('🔒 HARD GATE 2: Tree depth validation');
  if (!structure.tree || structure.tree.length === 0) {
    fail('❌ GATE FAILED: Tree is empty');
  }

  const sampleSeason = structure.tree[0];
  if (!sampleSeason.episodes || sampleSeason.episodes.length === 0) {
    fail('❌ GATE FAILED: Season has no episodes in tree');
  }

  const sampleEpisode = sampleSeason.episodes[0];
  if (!sampleEpisode.scenes || sampleEpisode.scenes.length === 0) {
    fail('❌ GATE FAILED: Episode has no scenes in tree');
  }

  const sampleScene = sampleEpisode.scenes[0];
  if (!sampleScene.shots || sampleScene.shots.length === 0) {
    fail('❌ GATE FAILED: Scene has no shots in tree');
  }

  log('✅ GATE 2 PASSED: Tree depth = 4 (Season→Episode→Scene→Shot)');
  log('🎉 ALL HARD GATES PASSED');
  log('✅ Contract Verified Successfully');
}

main();
