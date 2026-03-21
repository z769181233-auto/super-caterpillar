import * as dotenv from 'dotenv';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as { Client: new (opts: { connectionString: string }) => PgClient };

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

interface PgClient {
  connect(): Promise<void>;
  query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}

function getCliArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index >= 0) {
    const value = process.argv[index + 1];
    if (value && !value.startsWith('--')) {
      return value;
    }
  }

  return undefined;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const sceneIdArg = getCliArg('sceneId');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const sceneResult = await client.query(
      sceneIdArg
        ? `
            SELECT id, "episodeId", project_id, film_ir_id
            FROM scenes
            WHERE id = $1
            LIMIT 1
          `
        : `
            SELECT id, "episodeId", project_id, film_ir_id
            FROM scenes
            WHERE film_ir_id IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 1
          `,
      sceneIdArg ? [sceneIdArg] : [],
    );
    const scene = sceneResult.rows[0];
    if (!scene) {
      throw new Error(sceneIdArg ? `Scene ${sceneIdArg} not found` : 'No scene with Film IR found');
    }

    const filmIrResult = await client.query(
      `SELECT id, status FROM film_ir WHERE id = $1 LIMIT 1`,
      [scene.film_ir_id],
    );
    const filmIr = filmIrResult.rows[0] ?? null;

    const shotCounts = await client.query(
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

    const shotPlanningCount = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM shot_plannings sp
        JOIN shots s ON s.id = sp."shotId"
        WHERE s."sceneId" = $1
      `,
      [scene.id],
    );

    const continuitySnapshotCount = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM continuity_state_snapshots
        WHERE scene_id = $1
      `,
      [scene.id],
    );
    const activeContinuityState = await client.query(
      `
        SELECT source, is_locked, state_data
        FROM continuity_states
        WHERE project_id = $1
          AND entity_type = 'SCENE'
          AND entity_id = $2
          AND at_scene_id = $3
        LIMIT 1
      `,
      [scene.project_id, scene.id, scene.id],
    );

    const gateResults = await client.query(
      `
        SELECT gate_verdict, created_at
        FROM content_gate_results
        WHERE scene_id = $1
        ORDER BY created_at DESC
      `,
      [scene.id],
    );

    const publishVideos = scene.episodeId
      ? await client.query(
          `
            SELECT metadata
            FROM published_videos
            WHERE "episodeId" = $1
            ORDER BY "createdAt" DESC
          `,
          [scene.episodeId],
        )
      : { rows: [] as Array<{ metadata: any }> };

    const latestPublishedDirectorLayer =
      publishVideos.rows[0]?.metadata?.directorLayer ?? null;

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
      activeContinuitySource: activeContinuityState.rows[0]?.source ?? null,
      activeContinuityLocked: !!activeContinuityState.rows[0]?.is_locked,
      activeContinuityResolutionMode:
        typeof activeContinuityState.rows[0]?.state_data?.resolutionMode === 'string'
          ? activeContinuityState.rows[0].state_data.resolutionMode
          : null,
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

    const passed =
      checks.hasFilmIr &&
      checks.hasApprovedOrLockedFilmIr &&
      checks.hasShots &&
      checks.hasShotPlanning &&
      checks.hasShotFilmIrProjection &&
      checks.hasDirectorFieldsOnShots &&
      checks.hasContinuitySnapshots &&
      checks.hasContentGateResults &&
      checks.hasPublishDirectorEvidence;

    console.log(
      JSON.stringify(
        {
          verdict: passed ? 'PASS' : 'FAIL',
          checks,
          summary,
        },
        null,
        2,
      ),
    );

    if (!passed) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
    process.exit(process.exitCode ?? 0);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
