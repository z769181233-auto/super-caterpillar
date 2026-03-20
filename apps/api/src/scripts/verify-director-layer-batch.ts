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
  profiles: Record<
    string,
    {
      description: string;
      sceneIds: string[];
    }
  >;
};

type SceneRow = {
  id: string;
  episodeId: string | null;
  project_id: string;
  film_ir_id: string | null;
};

async function verifyScene(client: PgClient, scene: SceneRow) {
  const filmIrResult = await client.query<{ id: string; status: string }>(
    `SELECT id, status FROM film_ir WHERE id = $1 LIMIT 1`,
    [scene.film_ir_id],
  );
  const filmIr = filmIrResult.rows[0] ?? null;

  const shotCounts = await client.query<{
    shot_count: number;
    shot_film_ir_count: number;
    shot_director_fields_count: number;
  }>(
    `
      SELECT
        COUNT(*)::int AS shot_count,
        COUNT(*) FILTER (WHERE film_ir_id IS NOT NULL)::int AS shot_film_ir_count,
        COUNT(*) FILTER (WHERE dramatic_function IS NOT NULL OR emotional_target IS NOT NULL)::int AS shot_director_fields_count
      FROM shots
      WHERE "sceneId" = $1
    `,
    [scene.id],
  );

  const shotPlanningCount = await client.query<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM shot_plannings sp
      JOIN shots s ON s.id = sp."shotId"
      WHERE s."sceneId" = $1
    `,
    [scene.id],
  );

  const continuitySnapshotCount = await client.query<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM continuity_state_snapshots
      WHERE scene_id = $1
    `,
    [scene.id],
  );

  const gateResults = await client.query<{ gate_verdict: string | null; created_at: string }>(
    `
      SELECT gate_verdict, created_at
      FROM content_gate_results
      WHERE scene_id = $1
      ORDER BY created_at DESC
    `,
    [scene.id],
  );

  const publishVideos = scene.episodeId
    ? await client.query<{ metadata: { directorLayer?: Record<string, unknown> | null } | null }>(
        `
          SELECT metadata
          FROM published_videos
          WHERE "episodeId" = $1
          ORDER BY "createdAt" DESC
        `,
        [scene.episodeId],
      )
    : { rows: [] as Array<{ metadata: { directorLayer?: Record<string, unknown> | null } | null }> };

  const latestPublishedDirectorLayer = publishVideos.rows[0]?.metadata?.directorLayer ?? null;

  const summary = {
    sceneId: scene.id,
    episodeId: scene.episodeId,
    projectId: scene.project_id,
    filmIrId: scene.film_ir_id,
    filmIrStatus: filmIr?.status ?? null,
    shotCount: Number(shotCounts.rows[0]?.shot_count ?? 0),
    shotPlanningCount: Number(shotPlanningCount.rows[0]?.count ?? 0),
    shotsWithFilmIrCount: Number(shotCounts.rows[0]?.shot_film_ir_count ?? 0),
    shotsWithDirectorFieldsCount: Number(shotCounts.rows[0]?.shot_director_fields_count ?? 0),
    continuitySnapshotCount: Number(continuitySnapshotCount.rows[0]?.count ?? 0),
    contentGateResultCount: gateResults.rows.length,
    latestGateVerdict: gateResults.rows[0]?.gate_verdict ?? null,
    publishedVideoCount: publishVideos.rows.length,
    latestPublishedDirectorLayer,
  };

  const checks = {
    hasFilmIr: !!summary.filmIrId,
    hasApprovedOrLockedFilmIr:
      summary.filmIrStatus === 'APPROVED' || summary.filmIrStatus === 'LOCKED',
    hasShots: summary.shotCount > 0,
    hasShotPlanning: summary.shotPlanningCount > 0,
    hasShotFilmIrProjection: summary.shotsWithFilmIrCount > 0,
    hasDirectorFieldsOnShots: summary.shotsWithDirectorFieldsCount > 0,
    hasContinuitySnapshots: summary.continuitySnapshotCount > 0,
    hasContentGateResults: summary.contentGateResultCount > 0,
    hasPublishDirectorEvidence:
      summary.publishedVideoCount > 0 && !!summary.latestPublishedDirectorLayer,
  };

  const passed = Object.values(checks).every(Boolean);
  return { verdict: passed ? 'PASS' : 'FAIL', checks, summary };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const limitArg = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? '5');
  const sceneIdsArg = process.argv.find((arg) => arg.startsWith('--sceneIds='))?.split('=')[1];
  const profileArg =
    process.argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1] ??
    'director-layer-minimal-closure';
  const registryPath = path.resolve(
    __dirname,
    '../../../../docs/_specs/DIRECTOR_LAYER_ACCEPTANCE_REGISTRY.json',
  );
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    let registrySceneIds: string[] = [];
    if (!sceneIdsArg && fs.existsSync(registryPath)) {
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as AcceptanceRegistry;
      const activeProfile = registry.profiles[profileArg] ?? registry.profiles[registry.defaultProfile];
      registrySceneIds = activeProfile?.sceneIds ?? [];
    }

    let scenes = sceneIdsArg
      ? await client.query<SceneRow>(
          `
            SELECT id, "episodeId", project_id, film_ir_id
            FROM scenes
            WHERE id = ANY($1::text[])
            ORDER BY updated_at DESC
          `,
          [sceneIdsArg.split(',').map((id) => id.trim()).filter(Boolean)],
        )
      : registrySceneIds.length > 0
        ? await client.query<SceneRow>(
            `
              SELECT id, "episodeId", project_id, film_ir_id
              FROM scenes
              WHERE id = ANY($1::text[])
              ORDER BY updated_at DESC
          `,
          [registrySceneIds],
        )
      : await client.query<SceneRow>(
          `
            SELECT id, "episodeId", project_id, film_ir_id
            FROM scenes
            WHERE film_ir_id IS NOT NULL
              AND id ~ '^[0-9a-f-]{36}$'
            ORDER BY updated_at DESC
            LIMIT $1
          `,
          [limitArg],
        );

    if (!sceneIdsArg && registrySceneIds.length > 0 && scenes.rows.length === 0) {
      scenes = await client.query<SceneRow>(
        `
          SELECT id, "episodeId", project_id, film_ir_id
          FROM scenes
          WHERE film_ir_id IS NOT NULL
            AND id ~ '^[0-9a-f-]{36}$'
          ORDER BY updated_at DESC
          LIMIT $1
        `,
        [limitArg],
      );
    }

    if (scenes.rows.length === 0) {
      throw new Error('No Film IR scenes found for batch verification');
    }

    const results = [];
    for (const scene of scenes.rows) {
      results.push(await verifyScene(client, scene));
    }

    const failed = results.filter((result) => result.verdict !== 'PASS');
    const payload = {
      verdict: failed.length === 0 ? 'PASS' : 'FAIL',
      profile: sceneIdsArg ? null : profileArg,
      totalScenes: results.length,
      passedScenes: results.length - failed.length,
      failedScenes: failed.length,
      results,
    };

    console.log(JSON.stringify(payload, null, 2));
    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
