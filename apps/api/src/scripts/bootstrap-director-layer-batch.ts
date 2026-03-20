import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

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

function resolveSceneIds(): { profile: string; sceneIds: string[] } {
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

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as AcceptanceRegistry;
  const activeProfile = registry.profiles[profileArg] ?? registry.profiles[registry.defaultProfile];
  const sceneIds = activeProfile?.sceneIds ?? [];
  if (sceneIds.length === 0) {
    throw new Error(`No sceneIds found for profile: ${profileArg}`);
  }

  return { profile: profileArg, sceneIds };
}

function main() {
  const { profile, sceneIds } = resolveSceneIds();
  const scriptPath = path.resolve(__dirname, './bootstrap-director-layer-closure.ts');

  const results = sceneIds.map((sceneId) => {
    const run = spawnSync(
      process.execPath,
      [
        require.resolve('ts-node/dist/bin.js'),
        '-r',
        'tsconfig-paths/register',
        scriptPath,
        `--sceneId=${sceneId}`,
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
      sceneId,
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

main();
