import { randomUUID } from 'crypto';

const API_URL = 'http://localhost:3000';
const MAX_RETRIES = 30; // 30 attempts
const RETRY_DELAY_MS = 2000; // 2 seconds

interface ApiResponse<T> {
  success?: boolean;
  data: T;
  message?: string;
}

interface Project {
  id: string;
  name: string;
}

interface Episode {
  id: string;
  name: string;
}

interface Scene {
  id: string;
  title: string;
}

interface SemanticData {
  summary: string;
  keywords: string[];
  // Add other expected fields
}

// Helper for delays
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for Fetch
async function fetchJson<T>(url: string, options: any): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const contentType = res.headers.get('content-type');
    let data: any;

    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      if (!res.ok) throw new Error(`Request failed (${res.status}): ${text}`);
      return { data: text as any };
    }

    if (!res.ok) {
      throw new Error(`Request failed (${res.status}): ${JSON.stringify(data)}`);
    }

    return data as ApiResponse<T>;
  } catch (e: any) {
    throw new Error(`Network/API Error: ${e.message}`);
  }
}

// Polling Helper
async function pollForCondition<T>(
  fn: () => Promise<T>,
  check: (result: T) => boolean,
  intervalMs: number = 1000,
  maxAttempts: number = 10
): Promise<T> {
  let lastError;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await fn();
      // Optional: log progress
      // process.stdout.write('.');
      if (check(result)) return result;
      console.log(`   ...waiting for processing to complete (attempt ${i + 1}/${maxAttempts})`);
    } catch (e) {
      lastError = e;
      console.log(
        `   ...transient error or still processing (attempt ${i + 1}/${maxAttempts}): ${e}`
      );
    }
    await delay(intervalMs);
  }
  throw new Error(`Polling timed out after ${maxAttempts} attempts. Last error: ${lastError}`);
}

async function verifyStage4() {
  console.log('🛡️  Starting ROBUST Stage 4 Verification...');
  const uniqueId = randomUUID().substring(0, 8);
  let authToken = '';

  try {
    // 1. Authenticate
    console.log('1️⃣  Authenticating...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'password123',
      }),
    });

    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);

    const cookieHeader = loginRes.headers.get('set-cookie');
    if (!cookieHeader) throw new Error('No cookie received');

    const match = cookieHeader.match(/accessToken=([^;]+)/);
    if (!match) throw new Error('Could not extract accessToken');
    authToken = match[1];

    console.log('   ✅ Authenticated.');

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };

    // 2. Create Project
    console.log('2️⃣  Creating Project...');
    const projectRes = await fetchJson<Project>(`${API_URL}/api/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Stage4 Verify ${uniqueId}`,
        description: 'Automated verification project (Zero Mines)',
      }),
    });
    const projectId = projectRes.data?.id;
    if (!projectId) throw new Error('Failed to get Project ID');
    console.log(`   ✅ Project created: ${projectId}`);

    // 3. Create Structure
    console.log('3️⃣  Creating Episode & Scene...');
    const episodeRes = await fetchJson<Episode>(`${API_URL}/api/projects/${projectId}/episodes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'E2E Episode', index: 1 }),
    });
    const episodeId = episodeRes.data?.id;

    const sceneRes = await fetchJson<Scene>(
      `${API_URL}/api/projects/episodes/${episodeId}/scenes`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'E2E Scene',
          index: 1,
          summary:
            'The quick brown fox jumps over the lazy dog. This is a testing summary for semantic analysis.',
        }),
      }
    );
    const sceneId = sceneRes.data?.id;
    console.log(`   ✅ Structure created (Scene ID: ${sceneId})`);

    // 4. Trigger Analysis
    console.log('4️⃣  Triggering Semantic Enhancement...');
    const promptEndpoint = `${API_URL}/api/stage4/projects/${projectId}/scenes/${sceneId}/semantic-enhancement`;

    await fetchJson(promptEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({}), // Empty body usually triggers default params
    });
    console.log('   ✅ Triggered successfully.');

    // 5. Verify Results (Polling)
    console.log('5️⃣  Verifying Results (Polling)...');

    const result = await pollForCondition<SemanticData | null>(
      async () => {
        const res = await fetchJson<SemanticData>(promptEndpoint, { method: 'GET', headers });
        return res.data;
      },
      (data) => {
        // strict validation
        // Ensure specifically that keywords are an array and populated
        return !!data && !!data.summary && Array.isArray(data.keywords) && data.keywords.length > 0;
      },
      RETRY_DELAY_MS,
      MAX_RETRIES
    );

    if (!result) throw new Error('Validation failed: Result is null');

    console.log('   ✅ Data Verified!');
    console.log('      Summary:', result.summary.substring(0, 50) + '...');
    console.log('      Keywords:', result.keywords.join(', '));

    console.log('🎉 Verification PASSED with flying colors!');
  } catch (error: any) {
    console.error('❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

verifyStage4();
