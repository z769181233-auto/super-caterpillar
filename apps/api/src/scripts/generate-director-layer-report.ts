import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
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
  profiles: Record<string, { description: string; sceneIds: string[] }>;
};

type SceneSummary = {
  id: string;
  episodeId: string | null;
  project_id: string;
  film_ir_id: string | null;
};

function resolveOutputPath(): string {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='))?.split('=')[1];
  if (outputArg) {
    return path.resolve(outputArg);
  }
  const evidenceRoot = path.resolve(__dirname, '../../../../docs/_evidence');
  const outDir = path.join(
    evidenceRoot,
    `director_layer_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
  );
  fs.mkdirSync(outDir, { recursive: true });
  return path.join(outDir, 'DIRECTOR_LAYER_REPORT.md');
}

function resolveProfileAndScenes(): { profile: string; sceneIds: string[] } {
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
  return {
    profile: profileArg,
    sceneIds: activeProfile?.sceneIds ?? [],
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const outputPath = resolveOutputPath();
  const { profile, sceneIds } = resolveProfileAndScenes();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const scenes = sceneIds.length
      ? await client.query<SceneSummary>(
          `
            SELECT id, "episodeId", project_id, film_ir_id
            FROM scenes
            WHERE id = ANY($1::text[])
            ORDER BY updated_at DESC
          `,
          [sceneIds],
        )
      : await client.query<SceneSummary>(
          `
            SELECT id, "episodeId", project_id, film_ir_id
            FROM scenes
            WHERE film_ir_id IS NOT NULL
              AND id ~ '^[0-9a-f-]{36}$'
            ORDER BY updated_at DESC
            LIMIT 5
          `,
        );

    const lines: string[] = [];
    lines.push('# DIRECTOR LAYER REPORT');
    lines.push('');
    lines.push(`- Generated At: ${new Date().toISOString()}`);
    lines.push(`- Profile: ${profile}`);
    lines.push(`- Total Scenes: ${scenes.rows.length}`);
    lines.push('');
    lines.push('| Scene | Film IR | Shots | Shot Plan | Continuity | Gate | Publish | Verdict |');
    lines.push('|---|---:|---:|---:|---:|---:|---:|---|');

    for (const scene of scenes.rows) {
      const shotCounts = await client.query<{ shot_count: number }>(
        `SELECT COUNT(*)::int AS shot_count FROM shots WHERE "sceneId" = $1`,
        [scene.id],
      );
      const shotPlanningCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM shot_plannings sp JOIN shots s ON s.id = sp."shotId" WHERE s."sceneId" = $1`,
        [scene.id],
      );
      const continuityCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM continuity_state_snapshots WHERE scene_id = $1`,
        [scene.id],
      );
      const gateCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM content_gate_results WHERE scene_id = $1`,
        [scene.id],
      );
      const publishCount = scene.episodeId
        ? await client.query<{ count: number }>(
            `SELECT COUNT(*)::int AS count FROM published_videos WHERE "episodeId" = $1`,
            [scene.episodeId],
          )
        : { rows: [{ count: 0 }] };

      const verdict =
        !!scene.film_ir_id &&
        Number(shotCounts.rows[0]?.shot_count ?? 0) > 0 &&
        Number(shotPlanningCount.rows[0]?.count ?? 0) > 0 &&
        Number(continuityCount.rows[0]?.count ?? 0) > 0 &&
        Number(gateCount.rows[0]?.count ?? 0) > 0 &&
        Number(publishCount.rows[0]?.count ?? 0) > 0
          ? 'PASS'
          : 'FAIL';

      lines.push(
        `| \`${scene.id}\` | ${scene.film_ir_id ? '1' : '0'} | ${Number(
          shotCounts.rows[0]?.shot_count ?? 0,
        )} | ${Number(shotPlanningCount.rows[0]?.count ?? 0)} | ${Number(
          continuityCount.rows[0]?.count ?? 0,
        )} | ${Number(gateCount.rows[0]?.count ?? 0)} | ${Number(
          publishCount.rows[0]?.count ?? 0,
        )} | ${verdict} |`,
      );
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
    console.log(JSON.stringify({ verdict: 'REPORT_WRITTEN', outputPath }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
