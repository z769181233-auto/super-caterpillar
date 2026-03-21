import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
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

type SceneRow = {
  id: string;
  title: string | null;
  project_id: string;
  organizationId: string | null;
  episodeId: string | null;
  enriched_text: string | null;
  summary: string | null;
};

function summarizeText(text: string, max = 160): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}...`;
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
    console.log('[director-bootstrap] start');

    await client.query(`
      CREATE TABLE IF NOT EXISTS film_ir_runs (
        id text PRIMARY KEY,
        scene_id text NOT NULL,
        project_id text NOT NULL,
        film_ir_id text NOT NULL,
        planner_version text NOT NULL,
        provider text,
        model text,
        status text NOT NULL,
        input_snapshot jsonb,
        output_snapshot jsonb,
        validation_valid boolean NOT NULL DEFAULT false,
        validation_errors jsonb,
        validation_warnings jsonb,
        error_message text,
        evidence_ref text,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS continuity_state_snapshots (
        id text PRIMARY KEY,
        project_id text NOT NULL,
        scene_id text NOT NULL,
        shot_id text,
        trace_id text NOT NULL,
        source text NOT NULL,
        snapshot_type text NOT NULL,
        snapshot_data jsonb NOT NULL,
        evidence_ref text,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS continuity_state_locks (
        id text PRIMARY KEY,
        project_id text NOT NULL,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        at_scene_id text,
        at_shot_id text,
        lock_reason text,
        locked_by text,
        evidence_ref text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS continuity_state_overrides (
        id text PRIMARY KEY,
        project_id text NOT NULL,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        at_scene_id text,
        at_shot_id text,
        override_data jsonb NOT NULL,
        override_reason text,
        override_by text,
        evidence_ref text,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    const sceneResult = await client.query<SceneRow>(
      sceneIdArg
        ? `
            SELECT s.id, s.title, s.project_id, s."episodeId", s.enriched_text, s.summary, p."organizationId"
            FROM scenes s
            LEFT JOIN projects p ON p.id = s.project_id
            WHERE s.id = $1
            LIMIT 1
          `
        : `
            SELECT s.id, s.title, s.project_id, s."episodeId", s.enriched_text, s.summary, p."organizationId"
            FROM scenes s
            LEFT JOIN projects p ON p.id = s.project_id
            WHERE s.id ~ '^[0-9a-f-]{36}$'
            ORDER BY s.updated_at DESC
            LIMIT 1
          `,
      sceneIdArg ? [sceneIdArg] : [],
    );

    let scene = sceneResult.rows[0];

    const ensureBootstrapPrincipal = async () => {
      await client.query(
        `
          INSERT INTO "users" (id, email, "passwordHash", role, "createdAt", "updatedAt")
          VALUES ('user-gate', 'gate@example.com', 'director-bootstrap', 'ADMIN', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `,
      );
      await client.query(
        `
          INSERT INTO organizations (id, name, "ownerId", "createdAt", "updatedAt")
          VALUES ('gate-org', 'Gate Organization', 'user-gate', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `,
      );

      const ownerResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM "users"
          ORDER BY "createdAt" ASC
          LIMIT 1
        `,
      );
      const organizationResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM organizations
          ORDER BY "createdAt" ASC
          LIMIT 1
        `,
      );

      const ownerId = ownerResult.rows[0]?.id;
      const organizationId = organizationResult.rows[0]?.id;
      if (!ownerId || !organizationId) {
        throw new Error('No eligible scene found and no user/organization available for bootstrap fallback');
      }

      return { ownerId, organizationId };
    };

    if (!scene) {
      const { ownerId, organizationId } = await ensureBootstrapPrincipal();
      const projectId = randomUUID();
      const syntheticSceneId = sceneIdArg ?? randomUUID();

      await client.query(
        `
          INSERT INTO projects (
            id, name, description, "ownerId", "organizationId", status, "createdAt", "updatedAt"
          ) VALUES (
            $1, 'Director Bootstrap Project', 'Synthetic project for director-layer closure bootstrap', $2, $3, 'in_progress', NOW(), NOW()
          )
        `,
        [projectId, ownerId, organizationId],
      );
      await client.query(
        `
          INSERT INTO scenes (
            id, "episodeId", scene_index, status, title, summary, project_id, enriched_text, created_at, updated_at
          ) VALUES (
            $1, NULL, 1, 'PENDING', 'Director Bootstrap Scene', 'Synthetic scene for director-layer closure bootstrap', $2,
            'Synthetic scene for director-layer closure bootstrap', NOW(), NOW()
          )
        `,
        [syntheticSceneId, projectId],
      );

      scene = {
        id: syntheticSceneId,
        title: 'Director Bootstrap Scene',
        project_id: projectId,
        organizationId,
        episodeId: null,
        enriched_text: 'Synthetic scene for director-layer closure bootstrap',
        summary: 'Synthetic scene for director-layer closure bootstrap',
      };
    }

    if (!scene.organizationId) {
      const { ownerId, organizationId } = await ensureBootstrapPrincipal();
      await client.query(
        `
          INSERT INTO projects (
            id, name, description, "ownerId", "organizationId", status, "createdAt", "updatedAt"
          ) VALUES (
            $1, 'Director Bootstrap Project', 'Synthetic project for director-layer closure bootstrap', $2, $3, 'in_progress', NOW(), NOW()
          )
          ON CONFLICT (id) DO UPDATE
          SET "organizationId" = EXCLUDED."organizationId",
              "ownerId" = EXCLUDED."ownerId",
              "updatedAt" = NOW()
        `,
        [scene.project_id, ownerId, organizationId],
      );
      scene.organizationId = organizationId;
    }

    console.log(`[director-bootstrap] scene=${scene.id}`);

    let effectiveEpisodeId = scene.episodeId;

    if (!effectiveEpisodeId) {
      const nextEpisodeIndexResult = await client.query<{ next_index: number }>(
        `
          SELECT COALESCE(MAX(index), 0) + 1 AS next_index
          FROM episodes
          WHERE "projectId" = $1
        `,
        [scene.project_id],
      );
      const syntheticEpisodeId = randomUUID();
      const syntheticEpisodeIndex = Number(nextEpisodeIndexResult.rows[0]?.next_index ?? 1);

      await client.query(
        `
          INSERT INTO episodes (id, "projectId", index, name, summary, status)
          VALUES ($1, $2, $3, $4, $5, 'bootstrap')
        `,
        [
          syntheticEpisodeId,
          scene.project_id,
          syntheticEpisodeIndex,
          `Director Bootstrap Episode ${syntheticEpisodeIndex}`,
          `Synthetic episode for director-layer closure scene ${scene.id}`,
        ],
      );

      await client.query(`UPDATE scenes SET "episodeId" = $2, updated_at = NOW() WHERE id = $1`, [
        scene.id,
        syntheticEpisodeId,
      ]);

      effectiveEpisodeId = syntheticEpisodeId;
    }

    const sourceText = scene.enriched_text || scene.summary || scene.title || 'Director bootstrap scene';
    const sourceContextSummary = scene.summary || summarizeText(sourceText, 120);

    const existingFilmIr = await client.query<{ id: string; status: string }>(
      `
        SELECT id, status
        FROM film_ir
        WHERE scene_id = $1 AND planner_version = 'film-planner-v1'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [scene.id],
    );

    const filmIrId = existingFilmIr.rows[0]?.id ?? randomUUID();
    if (existingFilmIr.rows.length === 0) {
      await client.query(
        `
          INSERT INTO film_ir (
            id, scene_id, project_id, planner_version, status,
            source_text, source_context_summary,
            dramatic_function, dramatic_goal, emotional_target,
            visual_strategy, blocking_strategy, shot_pattern, avg_shot_length_sec,
            camera_motion_style, composition_style, lighting_style, color_strategy, sound_strategy,
            continuity_constraints, why_this_choice, alternative_rejected_reason,
            quality_score, confidence, evidence_ref, created_at, updated_at
          ) VALUES (
            $1,$2,$3,'film-planner-v1','LOCKED',
            $4,$5,
            'CONFLICT',$6,'压迫感 → 紧张对峙 → 短暂呼吸',
            '近景主导，强调角色反应','角色保持对立压缩空间','CLOSE_UP_DOMINANT',3.5,
            'STATIC','三等分对峙构图','LOW_KEY','冷蓝低饱和','环境音渐弱，对话主导',
            $7::jsonb,'Bootstrap 以最小风险验证 director-layer 数据闭环','无需真实媒体信号即可先验证协议闭环',
            0.82,0.88,$8,NOW(),NOW()
          )
        `,
        [
          filmIrId,
          scene.id,
          scene.project_id,
          sourceText,
          sourceContextSummary,
          `基于场景「${summarizeText(sourceText, 40)}」的最小闭环导演规划`,
          JSON.stringify({ mustMatch: ['character_costume', 'location'], canChange: ['expression'] }),
          `director-bootstrap:${scene.id}`,
        ],
      );
    } else if (existingFilmIr.rows[0].status !== 'LOCKED') {
      await client.query(`UPDATE film_ir SET status = 'LOCKED', updated_at = NOW() WHERE id = $1`, [filmIrId]);
    }

    await client.query(`UPDATE scenes SET film_ir_id = $2, updated_at = NOW() WHERE id = $1`, [scene.id, filmIrId]);
    console.log(`[director-bootstrap] filmIr=${filmIrId}`);

    await client.query(
      `
        INSERT INTO film_ir_runs (
          id, scene_id, project_id, film_ir_id, planner_version, provider, model, status,
          input_snapshot, output_snapshot, validation_valid, validation_errors, validation_warnings, error_message, evidence_ref
        )
        SELECT $1,$2,$3,$4,'film-planner-v1','mock','mock-model-v1','SUCCEEDED',
               $5::jsonb,$6::jsonb,TRUE,'[]'::jsonb,'[]'::jsonb,NULL,$7
        WHERE NOT EXISTS (
          SELECT 1 FROM film_ir_runs
          WHERE scene_id = $2 AND planner_version = 'film-planner-v1' AND status = 'SUCCEEDED'
        )
      `,
      [
        randomUUID(),
        scene.id,
        scene.project_id,
        filmIrId,
        JSON.stringify({ sourceTextLength: sourceText.length }),
        JSON.stringify({ dramatic_function: 'CONFLICT', shot_pattern: 'CLOSE_UP_DOMINANT' }),
        `director-bootstrap:${scene.id}`,
      ],
    );

    const shotCountResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM shots WHERE "sceneId" = $1`,
      [scene.id],
    );
    const shotCount = Number(shotCountResult.rows[0]?.count ?? '0');

    if (shotCount === 0) {
      for (let i = 0; i < 2; i++) {
        await client.query(
          `
            INSERT INTO shots (
              id, "sceneId", index, type, shot_type, action_description, novel_quote,
              "organizationId", film_ir_id, dramatic_function, emotional_target
            ) VALUES (
              $1,$2,$3,'generated',$4,$5,$6,$7,$8,'CONFLICT','压迫感 → 紧张对峙 → 短暂呼吸'
            )
          `,
          [
            `shot_bootstrap_${scene.id}_${i + 1}`,
            scene.id,
            i + 1,
            i === 0 ? 'wide' : 'close_up',
            `Bootstrap shot ${i + 1}: ${summarizeText(sourceText, 80)}`,
            summarizeText(sourceText, 120),
            scene.organizationId,
            filmIrId,
          ],
        );
      }
    } else {
      await client.query(
        `
          UPDATE shots
          SET
            film_ir_id = COALESCE(film_ir_id, $2),
            dramatic_function = COALESCE(dramatic_function, 'CONFLICT'),
            emotional_target = COALESCE(emotional_target, '压迫感 → 紧张对峙 → 短暂呼吸'),
            novel_quote = COALESCE(novel_quote, $3),
            action_description = COALESCE(action_description, $4)
          WHERE "sceneId" = $1
        `,
        [scene.id, filmIrId, summarizeText(sourceText, 120), `Bootstrap shot: ${summarizeText(sourceText, 80)}`],
      );
    }

    await client.query(
      `
        INSERT INTO shot_plannings (id, "shotId", "createdAt", "updatedAt", data, "engineKey", "engineVersion")
        SELECT
          gen_random_uuid()::text,
          s.id,
          NOW(),
          NOW(),
          jsonb_build_object(
            'shotType', COALESCE(s.shot_type, 'medium'),
            'movement', COALESCE(s.camera_movement, 'STATIC'),
            'angle', COALESCE(s.camera_angle, 'EYE_LEVEL'),
            'lighting', COALESCE(s.lighting_preset, 'NATURAL'),
            'visualPrompt', COALESCE(s.visual_prompt, $2::text),
            'action', COALESCE(s.action_description, $3::text),
            'filmIrId', $4::text,
            'dramaticFunction', COALESCE(s.dramatic_function, 'CONFLICT'),
            'emotionalTarget', COALESCE(s.emotional_target, '压迫感 → 紧张对峙 → 短暂呼吸'),
            'shotPattern', 'CLOSE_UP_DOMINANT',
            'continuityConstraints', jsonb_build_object('mustMatch', jsonb_build_array('character_costume', 'location')),
            'plannerVersion', 'film-planner-v1',
            'raw', jsonb_build_object('bootstrap', true, 'sceneId', $1::text)
          ),
          'director_layer_bootstrap',
          'film-planner-v1'
        FROM shots s
        WHERE s."sceneId" = $1::text
          AND NOT EXISTS (SELECT 1 FROM shot_plannings sp WHERE sp."shotId" = s.id)
      `,
      [scene.id, `Bootstrap visual: ${summarizeText(sourceText, 80)}`, `Bootstrap shot: ${summarizeText(sourceText, 80)}`, filmIrId],
    );
    console.log('[director-bootstrap] shots projected');

    await client.query(
      `
        DELETE FROM continuity_states
        WHERE project_id = $1 AND entity_type = 'SCENE' AND entity_id = $2 AND at_scene_id = $2
      `,
      [scene.project_id, scene.id],
    );
    await client.query(
      `
        INSERT INTO continuity_states (
          id, project_id, entity_type, entity_id, at_scene_id, at_shot_id,
          state_data, is_locked, source, violation_flag, created_at, updated_at
        ) VALUES (
          $1,$2,'SCENE',$3,$3,NULL,$4::jsonb,FALSE,'DIRECTOR_BOOTSTRAP',FALSE,NOW(),NOW()
        )
      `,
      [
        randomUUID(),
        scene.project_id,
        scene.id,
        JSON.stringify({
          mode: 'scene',
          sceneId: scene.id,
          projectId: scene.project_id,
          episodeId: effectiveEpisodeId,
          filmIrId,
          hasEnrichedText: true,
          bootstrap: true,
        }),
      ],
    );
    await client.query(
      `
        INSERT INTO continuity_state_snapshots (
          id, project_id, scene_id, shot_id, trace_id, source, snapshot_type, snapshot_data, evidence_ref, created_at
        )
        SELECT $1,$2,$3,NULL,$4,'DIRECTOR_BOOTSTRAP','SCENE_AUDIT',$5::jsonb,$6,NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM continuity_state_snapshots
          WHERE scene_id = $3 AND trace_id = $4 AND snapshot_type = 'SCENE_AUDIT'
        )
      `,
      [
        randomUUID(),
        scene.project_id,
        scene.id,
        `director_bootstrap_${scene.id}`,
        JSON.stringify({ sceneId: scene.id, filmIrId, bootstrap: true }),
        filmIrId,
      ],
    );
    console.log('[director-bootstrap] continuity ensured');

    await client.query(
      `
        INSERT INTO content_gate_results (
          id, project_id, scene_id, episode_id, film_ir_id, gate_version,
          dramatic_alignment_score, visual_strategy_match_score, continuity_score, shot_coherence_score,
          rhythm_score, character_consistency_score, sound_alignment_score, publish_readiness_score,
          gate_verdict, gate_details, evidence_ref, created_at
        )
        SELECT
          $1,$2,$3,$4,$5,'director-bootstrap-v1',
          0.82,0.78,0.80,0.81,
          0.76,0.80,0.00,0.74,
          'WARN',$6::jsonb,$7,NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM content_gate_results
          WHERE scene_id = $3 AND film_ir_id = $5 AND gate_version = 'director-bootstrap-v1'
        )
      `,
      [
        randomUUID(),
        scene.project_id,
        scene.id,
        effectiveEpisodeId,
        filmIrId,
        JSON.stringify({
          bootstrap: true,
          thresholdProfile: 'advisory',
          gateReason: 'bootstrap_without_media_signals',
          gatePolicyLevel: 'WARN',
          publishAction: 'REQUIRE_REVIEW',
          thresholds: {
            pass: 0.7,
            warn: 0.55,
            identity: 0.6,
            publish: 0.58,
            continuity: 0.55,
          },
        }),
        `director-bootstrap:${scene.id}`,
      ],
    );
    await client.query(
      `
        UPDATE content_gate_results
        SET gate_details = COALESCE(gate_details, '{}'::jsonb) || $1::jsonb
        WHERE scene_id = $2
          AND film_ir_id = $3
          AND gate_version = 'director-bootstrap-v1'
      `,
      [
        JSON.stringify({
          bootstrap: true,
          thresholdProfile: 'advisory',
          gateReason: 'bootstrap_without_media_signals',
          gatePolicyLevel: 'WARN',
          publishAction: 'REQUIRE_REVIEW',
          thresholds: {
            pass: 0.7,
            warn: 0.55,
            identity: 0.6,
            publish: 0.58,
            continuity: 0.55,
          },
        }),
        scene.id,
        filmIrId,
      ],
    );
    console.log('[director-bootstrap] gate ensured');

    const finalShotCountResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM shots WHERE "sceneId" = $1`,
      [scene.id],
    );
    const firstShotResult = await client.query<{ id: string }>(
      `SELECT id FROM shots WHERE "sceneId" = $1 ORDER BY index ASC NULLS LAST LIMIT 1`,
      [scene.id],
    );
    const firstShotId = firstShotResult.rows[0]?.id ?? null;

    if (effectiveEpisodeId && firstShotId) {
      const jobTraceId = `director-bootstrap:${scene.id}`;
      const dedupeKey = `director-bootstrap:video-render:${scene.id}`;
      const pipelineRunId = `director-bootstrap:${scene.id}`;
      const storageKey = `director-bootstrap/${scene.project_id}/${effectiveEpisodeId}/${firstShotId}.mp4`;
      const hlsPlaylistUrl = `director-bootstrap/${scene.project_id}/${effectiveEpisodeId}/${firstShotId}/master.m3u8`;
      const publishedVideoId = randomUUID();
      const checksum = `director-bootstrap:${scene.id}`;
      let jobResult = JSON.stringify({
        bootstrap: true,
        sceneId: scene.id,
        shotId: firstShotId,
        storageKey,
        hlsPlaylistUrl,
        pipelineRunId,
      });
      const existingJobResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM shot_jobs
          WHERE dedupe_key = $1
          LIMIT 1
        `,
        [dedupeKey],
      );
      const syntheticJobId = existingJobResult.rows[0]?.id ?? randomUUID();

      if (existingJobResult.rows.length === 0) {
        await client.query(
          `
            INSERT INTO shot_jobs (
              id, "organizationId", "projectId", "episodeId", "sceneId", "shotId",
              status, type, priority, "maxRetry", "retryCount", attempts,
              payload, "createdAt", "updatedAt", "traceId", is_verification, dedupe_key, result, "current_step"
            ) VALUES (
            $1,$2,$3,$4,$5,$6,
              'SUCCEEDED','VIDEO_RENDER',0,0,0,1,
              $7::jsonb,NOW(),NOW(),$8,TRUE,$9,$10::jsonb,'PUBLISH_HLS'
            )
          `,
          [
            syntheticJobId,
            scene.organizationId,
            scene.project_id,
            effectiveEpisodeId,
            scene.id,
            firstShotId,
            JSON.stringify({ bootstrap: true, source: 'director-layer-closure' }),
            jobTraceId,
            dedupeKey,
            jobResult,
          ],
        );
      }

      const assetSeedId = randomUUID();
      await client.query(
        `
          INSERT INTO assets (
            id, "projectId", "createdAt", checksum, "createdByJobId", "ownerId", "ownerType",
            status, "storageKey", type, "shotId", hls_playlist_url, signed_url
          )
          SELECT $1,$2,NOW(),$3,$4,$5,'SHOT','PUBLISHED',$6,'VIDEO',$5,$7,$8
          WHERE NOT EXISTS (
            SELECT 1
            FROM assets
            WHERE "ownerType" = 'SHOT' AND "ownerId" = $5 AND type = 'VIDEO'
          )
        `,
        [assetSeedId, scene.project_id, checksum, syntheticJobId, firstShotId, storageKey, hlsPlaylistUrl, null],
      );

      const assetResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM assets
          WHERE "ownerType" = 'SHOT' AND "ownerId" = $1 AND type = 'VIDEO'
          LIMIT 1
        `,
        [firstShotId],
      );
      const assetId = assetResult.rows[0]?.id ?? assetSeedId;
      const signedUrl = `/api/assets/${assetId}/secure-url`;
      jobResult = JSON.stringify({
        bootstrap: true,
        sceneId: scene.id,
        shotId: firstShotId,
        assetId,
        storageKey,
        hlsPlaylistUrl,
        pipelineRunId,
        output: {
          assetId,
          storageKey,
          hls_playlist_url: hlsPlaylistUrl,
          signed_url: signedUrl,
        },
      });

      await client.query(
        `
          UPDATE assets
          SET
            "createdByJobId" = COALESCE("createdByJobId", $2),
            status = 'PUBLISHED',
            "storageKey" = COALESCE(NULLIF("storageKey", ''), $3),
            hls_playlist_url = COALESCE(hls_playlist_url, $4),
            signed_url = COALESCE(signed_url, $5)
          WHERE "ownerType" = 'SHOT' AND "ownerId" = $1 AND type = 'VIDEO'
        `,
        [firstShotId, syntheticJobId, storageKey, hlsPlaylistUrl, signedUrl],
      );

      await client.query(
        `
          UPDATE shot_jobs
          SET
            result = $2::jsonb,
            "updatedAt" = NOW()
          WHERE id = $1
        `,
        [syntheticJobId, jobResult],
      );

      await client.query(
        `
          INSERT INTO published_videos (
            id, "projectId", "episodeId", "assetId", "storageKey", checksum, status, metadata, "createdAt", "updatedAt"
          )
          SELECT
            $1,$2,$3,a.id,$4,$5,'PUBLISHED',
            jsonb_build_object(
              'pipelineRunId', NULL,
              'publishedAt', NOW()::text,
              'directorLayer', jsonb_build_object(
                'shotId', $6::text,
                'sceneId', $7::text,
                'filmIrId', $8::text,
                'latestGateResultId', cgr.id,
                'latestGateVersion', cgr.gate_version,
                'latestGateVerdict', cgr.gate_verdict,
                'publishReadinessScore', cgr.publish_readiness_score::text,
                'evidenceRef', cgr.evidence_ref,
                'gateEvaluatedAt', cgr.created_at::text,
                'thresholdProfile', cgr.gate_details->>'thresholdProfile',
                'gateReason', cgr.gate_details->>'gateReason',
                'gatePolicyLevel', cgr.gate_details->>'gatePolicyLevel',
                'publishAction', cgr.gate_details->>'publishAction',
                'gateThresholds', cgr.gate_details->'thresholds',
                'assetStorageKey', a."storageKey",
                'assetCreatedByJobId', a."createdByJobId",
                'hlsPlaylistUrl', a.hls_playlist_url,
                'signedUrl', a.signed_url
              )
            ),
            NOW(),
            NOW()
          FROM assets a
          LEFT JOIN LATERAL (
            SELECT id, gate_version, gate_verdict, publish_readiness_score, evidence_ref, created_at, gate_details
            FROM content_gate_results
            WHERE scene_id = $7 AND film_ir_id = $8
            ORDER BY created_at DESC
            LIMIT 1
          ) cgr ON TRUE
          WHERE a."ownerType" = 'SHOT' AND a."ownerId" = $6::text AND a.type = 'VIDEO'
            AND NOT EXISTS (
              SELECT 1 FROM published_videos pv WHERE pv."assetId" = a.id
            )
        `,
        [publishedVideoId, scene.project_id, effectiveEpisodeId, storageKey, checksum, firstShotId, scene.id, filmIrId],
      );

      await client.query(
        `
          UPDATE published_videos
          SET
            status = 'INTERNAL_READY',
            metadata =
              COALESCE(metadata, '{}'::jsonb)
              || jsonb_build_object(
                'pipelineRunId', $2::text,
                'publishedAt', NOW()::text,
                'directorLayer',
                COALESCE(metadata->'directorLayer', '{}'::jsonb)
                  || jsonb_build_object(
                    'assetStorageKey', $3::text,
                    'assetCreatedByJobId', $4::text,
                    'hlsPlaylistUrl', $5::text,
                    'signedUrl', $6::text
                  )
              ),
            "updatedAt" = NOW()
          WHERE "assetId" = $1
        `,
        [assetId, pipelineRunId, storageKey, syntheticJobId, hlsPlaylistUrl, signedUrl],
      );
    }
    console.log('[director-bootstrap] publish evidence ensured');

    console.log(
      JSON.stringify(
        {
          verdict: 'BOOTSTRAPPED',
          sceneId: scene.id,
          filmIrId,
          filmIrStatus: 'LOCKED',
          shotCount: Number(finalShotCountResult.rows[0]?.count ?? '0'),
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
