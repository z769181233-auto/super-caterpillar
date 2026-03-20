import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as { Client: new (opts: { connectionString: string }) => PgClient };

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

interface PgClient {
  connect(): Promise<void>;
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}

type AcceptanceRegistry = {
  version: number;
  updatedAt: string;
  defaultProfile: string;
  profiles: Record<
    string,
    {
      description: string;
      sceneIds: string[];
    }
  >;
};

async function resolveSceneIds(): Promise<{ profile: string; sceneIds: string[] }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const sceneIdsArg = process.argv.find((arg) => arg.startsWith('--sceneIds='))?.split('=')[1];
  const profileArg =
    process.argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1] ??
    'director-layer-minimal-closure';

  if (sceneIdsArg) {
    return {
      profile: 'explicit-scene-list',
      sceneIds: sceneIdsArg.split(',').map((id) => id.trim()).filter(Boolean),
    };
  }

  const registryPath = path.resolve(
    __dirname,
    '../../../../docs/_specs/DIRECTOR_LAYER_ACCEPTANCE_REGISTRY.json',
  );
  if (!fs.existsSync(registryPath)) {
    throw new Error(`Acceptance registry not found: ${registryPath}`);
  }

  let sceneIds: string[] = [];
  if (fs.existsSync(registryPath)) {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as AcceptanceRegistry;
    const activeProfile = registry.profiles[profileArg] ?? registry.profiles[registry.defaultProfile];
    sceneIds = activeProfile?.sceneIds ?? [];
  }

  if (sceneIds.length > 0) {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const existing = await client.query<{ id: string }>(
        `
          SELECT id
          FROM scenes
          WHERE id = ANY($1::text[])
        `,
        [sceneIds],
      );
      const existingIds = existing.rows.map((row) => row.id);
      if (existingIds.length > 0) {
        return { profile: profileArg, sceneIds: existingIds };
      }
    } finally {
      await client.end();
    }
  }

  return { profile: `${profileArg}:fallback-latest`, sceneIds: [] };
}

async function main() {
  const { profile, sceneIds } = await resolveSceneIds();
  const scriptPath = path.resolve(__dirname, './bootstrap-director-layer-closure.ts');

  const targets = sceneIds.length > 0 ? sceneIds : [null];
  const results = targets.map((sceneId) => {
    const run = spawnSync(
      process.execPath,
      [
        require.resolve('ts-node/dist/bin.js'),
        '-r',
        'tsconfig-paths/register',
        scriptPath,
        ...(sceneId ? [`--sceneId=${sceneId}`] : []),
      ],
      {
        cwd: path.resolve(__dirname, '../../..'),
        stdio: 'pipe',
        encoding: 'utf8',
        env: process.env,
      },
    );

    const stdout = run.stdout?.trim() ?? '';
    const stderr = run.stderr?.trim() ?? '';
    const success = run.status === 0;

    return {
      sceneId: sceneId ?? 'AUTO_LATEST_UUID_SCENE',
      verdict: success ? 'BOOTSTRAPPED' : 'FAILED',
      exitCode: run.status,
      stdout,
      stderr,
    };
  });

  const failed = results.filter((result) => result.verdict !== 'BOOTSTRAPPED');
  console.log(
    JSON.stringify(
      {
        verdict: failed.length === 0 ? 'BOOTSTRAPPED' : 'FAILED',
        profile,
        totalScenes: results.length,
        bootstrappedScenes: results.length - failed.length,
        failedScenes: failed.length,
        results,
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
