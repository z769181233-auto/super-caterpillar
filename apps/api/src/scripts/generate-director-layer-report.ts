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

function deriveFreshness(updatedAt: string | Date | null | undefined): string | null {
  if (!updatedAt) return null;
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const ageMs = Date.now() - timestamp;
  if (ageMs <= 5 * 60 * 1000) return 'FRESH';
  if (ageMs <= 24 * 60 * 60 * 1000) return 'STALE';
  return 'AGED';
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

type SceneEvidenceRow = {
  sceneId: string;
  episodeId: string | null;
  projectId: string;
  filmIrId: string | null;
  shotCount: number;
  shotPlanningCount: number;
  continuityCount: number;
  activeContinuitySource: string | null;
  activeContinuityLocked: boolean;
  activeContinuityResolutionMode: string | null;
  activeContinuityLifecycleStage: string | null;
  activeContinuityTransitionType: string | null;
  activeContinuityPreviousSource: string | null;
  activeContinuityFreshness: string | null;
  continuityLockCount: number;
  continuityOverrideCount: number;
  gateCount: number;
  publishCount: number;
  latestGateVerdict: string | null;
  latestGateReason: string | null;
  latestThresholdProfile: string | null;
  latestGatePolicyLevel: string | null;
  latestPublishAction: string | null;
  latestPublishEligibility: string | null;
  latestPolicyStage: string | null;
  latestEvidenceRef: string | null;
  latestPublishDirectorLayer: Record<string, unknown> | null;
  verdict: 'PASS' | 'FAIL';
};

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

function resolveOutputPath(): string {
  const outputArg = getCliArg('output');
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
  const sceneIdsArg = getCliArg('sceneIds');
  const profileArg = getCliArg('profile') ?? 'director-layer-minimal-closure';

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
    lines.push('| Scene | Film IR | Shots | Shot Plan | Continuity | Active State | Lifecycle | Transition | Freshness | Locks | Overrides | Gate | Publish | Verdict |');
    lines.push('|---|---:|---:|---:|---:|---|---|---|---|---:|---:|---:|---:|---|');
    const sceneEvidenceRows: SceneEvidenceRow[] = [];

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
      const activeContinuityState = await client.query<{
        source: string | null;
        is_locked: boolean | null;
        state_data: Record<string, unknown> | null;
        updated_at: string | null;
      }>(
        `
          SELECT source, is_locked, state_data, updated_at
          FROM continuity_states
          WHERE project_id = $1
            AND entity_type = 'SCENE'
            AND entity_id = $2
            AND at_scene_id = $3
          LIMIT 1
        `,
        [scene.project_id, scene.id, scene.id],
      );
      const continuityLockCount = await client.query<{ count: number }>(
        `
          SELECT COUNT(*)::int AS count
          FROM continuity_state_locks
          WHERE project_id = $1
            AND (at_scene_id IS NULL OR at_scene_id = $2)
        `,
        [scene.project_id, scene.id],
      );
      const continuityOverrideCount = await client.query<{ count: number }>(
        `
          SELECT COUNT(*)::int AS count
          FROM continuity_state_overrides
          WHERE project_id = $1
            AND (at_scene_id IS NULL OR at_scene_id = $2)
        `,
        [scene.project_id, scene.id],
      );
      const gateCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM content_gate_results WHERE scene_id = $1`,
        [scene.id],
      );
      const latestGate = await client.query<{
        gate_verdict: string | null;
        evidence_ref: string | null;
        gate_details: Record<string, unknown> | null;
      }>(
        `
          SELECT gate_verdict, evidence_ref, gate_details
          FROM content_gate_results
          WHERE scene_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [scene.id],
      );
      const publishCount = scene.episodeId
        ? await client.query<{ count: number; metadata: { directorLayer?: Record<string, unknown> | null } | null }>(
            `SELECT COUNT(*)::int AS count FROM published_videos WHERE "episodeId" = $1`,
            [scene.episodeId],
          )
        : { rows: [{ count: 0 }] };
      const latestPublish = scene.episodeId
        ? await client.query<{ metadata: { directorLayer?: Record<string, unknown> | null } | null }>(
            `
              SELECT metadata
              FROM published_videos
              WHERE "episodeId" = $1
              ORDER BY "createdAt" DESC
              LIMIT 1
            `,
            [scene.episodeId],
          )
        : { rows: [] as Array<{ metadata: { directorLayer?: Record<string, unknown> | null } | null }> };

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
        )} | ${
          activeContinuityState.rows[0]?.source
            ? `${activeContinuityState.rows[0].source}${
                activeContinuityState.rows[0]?.state_data?.resolutionMode
                  ? `/${String(activeContinuityState.rows[0].state_data.resolutionMode)}`
                  : ''
              }`
            : 'NONE'
        } | ${
          typeof activeContinuityState.rows[0]?.state_data?.lifecycleStage === 'string'
            ? String(activeContinuityState.rows[0]?.state_data?.lifecycleStage)
            : 'NONE'
        } | ${
          typeof activeContinuityState.rows[0]?.state_data?.transitionType === 'string'
            ? String(activeContinuityState.rows[0]?.state_data?.transitionType)
            : 'NONE'
        } | ${deriveFreshness(activeContinuityState.rows[0]?.updated_at) || 'UNKNOWN'} | ${Number(continuityLockCount.rows[0]?.count ?? 0)} | ${Number(
          continuityOverrideCount.rows[0]?.count ?? 0,
        )} | ${Number(gateCount.rows[0]?.count ?? 0)} | ${Number(
          publishCount.rows[0]?.count ?? 0,
        )} | ${verdict} |`,
      );

      sceneEvidenceRows.push({
        sceneId: scene.id,
        episodeId: scene.episodeId,
        projectId: scene.project_id,
        filmIrId: scene.film_ir_id,
        shotCount: Number(shotCounts.rows[0]?.shot_count ?? 0),
        shotPlanningCount: Number(shotPlanningCount.rows[0]?.count ?? 0),
        continuityCount: Number(continuityCount.rows[0]?.count ?? 0),
        activeContinuitySource: activeContinuityState.rows[0]?.source ?? null,
        activeContinuityLocked: !!activeContinuityState.rows[0]?.is_locked,
        activeContinuityResolutionMode:
          typeof activeContinuityState.rows[0]?.state_data?.resolutionMode === 'string'
            ? (activeContinuityState.rows[0]?.state_data?.resolutionMode as string)
            : null,
        activeContinuityLifecycleStage:
          typeof activeContinuityState.rows[0]?.state_data?.lifecycleStage === 'string'
            ? (activeContinuityState.rows[0]?.state_data?.lifecycleStage as string)
            : null,
        activeContinuityTransitionType:
          typeof activeContinuityState.rows[0]?.state_data?.transitionType === 'string'
            ? (activeContinuityState.rows[0]?.state_data?.transitionType as string)
            : null,
        activeContinuityPreviousSource:
          typeof activeContinuityState.rows[0]?.state_data?.previousSource === 'string'
            ? (activeContinuityState.rows[0]?.state_data?.previousSource as string)
            : null,
        activeContinuityFreshness: deriveFreshness(activeContinuityState.rows[0]?.updated_at),
        continuityLockCount: Number(continuityLockCount.rows[0]?.count ?? 0),
        continuityOverrideCount: Number(continuityOverrideCount.rows[0]?.count ?? 0),
        gateCount: Number(gateCount.rows[0]?.count ?? 0),
        publishCount: Number(publishCount.rows[0]?.count ?? 0),
        latestGateVerdict: latestGate.rows[0]?.gate_verdict ?? null,
        latestGateReason:
          typeof latestGate.rows[0]?.gate_details?.gateReason === 'string'
            ? (latestGate.rows[0]?.gate_details?.gateReason as string)
            : null,
        latestThresholdProfile:
          typeof latestGate.rows[0]?.gate_details?.thresholdProfile === 'string'
            ? (latestGate.rows[0]?.gate_details?.thresholdProfile as string)
            : null,
        latestGatePolicyLevel:
          typeof latestGate.rows[0]?.gate_details?.gatePolicyLevel === 'string'
            ? (latestGate.rows[0]?.gate_details?.gatePolicyLevel as string)
            : typeof latestPublish.rows[0]?.metadata?.directorLayer?.gatePolicyLevel === 'string'
              ? (latestPublish.rows[0]?.metadata?.directorLayer?.gatePolicyLevel as string)
            : null,
        latestPublishAction:
          typeof latestGate.rows[0]?.gate_details?.publishAction === 'string'
            ? (latestGate.rows[0]?.gate_details?.publishAction as string)
            : typeof latestPublish.rows[0]?.metadata?.directorLayer?.publishAction === 'string'
              ? (latestPublish.rows[0]?.metadata?.directorLayer?.publishAction as string)
              : null,
        latestPublishEligibility:
          typeof latestGate.rows[0]?.gate_details?.publishEligibility === 'string'
            ? (latestGate.rows[0]?.gate_details?.publishEligibility as string)
            : typeof latestPublish.rows[0]?.metadata?.directorLayer?.publishEligibility === 'string'
              ? (latestPublish.rows[0]?.metadata?.directorLayer?.publishEligibility as string)
              : null,
        latestPolicyStage:
          typeof latestGate.rows[0]?.gate_details?.policyStage === 'string'
            ? (latestGate.rows[0]?.gate_details?.policyStage as string)
            : typeof latestPublish.rows[0]?.metadata?.directorLayer?.policyStage === 'string'
              ? (latestPublish.rows[0]?.metadata?.directorLayer?.policyStage as string)
              : null,
        latestEvidenceRef: latestGate.rows[0]?.evidence_ref ?? null,
        latestPublishDirectorLayer: latestPublish.rows[0]?.metadata?.directorLayer ?? null,
        verdict,
      });
    }

    const aggregate = {
      totalLocks: sceneEvidenceRows.reduce((sum, row) => sum + row.continuityLockCount, 0),
      totalOverrides: sceneEvidenceRows.reduce((sum, row) => sum + row.continuityOverrideCount, 0),
      gateVerdicts: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.latestGateVerdict || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      thresholdProfiles: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.latestThresholdProfile || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      gatePolicyLevels: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.latestGatePolicyLevel || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      publishActions: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.latestPublishAction || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      publishEligibility: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.latestPublishEligibility || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      policyStages: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.latestPolicyStage || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      gateReasons: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.latestGateReason || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      continuitySources: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.activeContinuitySource || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      continuityResolutionModes: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.activeContinuityResolutionMode || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      continuityLifecycleStages: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.activeContinuityLifecycleStage || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      continuityTransitionTypes: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.activeContinuityTransitionType || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      continuityPreviousSources: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.activeContinuityPreviousSource || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      continuityFreshness: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.activeContinuityFreshness || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      coverageRoles: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key =
          typeof row.latestPublishDirectorLayer?.coverageRole === 'string'
            ? (row.latestPublishDirectorLayer.coverageRole as string)
            : 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      rhythmClasses: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key =
          typeof row.latestPublishDirectorLayer?.rhythmClass === 'string'
            ? (row.latestPublishDirectorLayer.rhythmClass as string)
            : 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      plannerVersions: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key =
          typeof row.latestPublishDirectorLayer?.plannerVersion === 'string'
            ? (row.latestPublishDirectorLayer.plannerVersion as string)
            : 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      shotPlannerRuleSetVersions: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key =
          typeof row.latestPublishDirectorLayer?.shotPlannerRuleSetVersion === 'string'
            ? (row.latestPublishDirectorLayer.shotPlannerRuleSetVersion as string)
            : 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      shotPlannerMatchedRuleIds: sceneEvidenceRows.reduce<Record<string, number>>((acc, row) => {
        const values = Array.isArray(row.latestPublishDirectorLayer?.shotPlannerMatchedRuleIds)
          ? row.latestPublishDirectorLayer.shotPlannerMatchedRuleIds
          : [];
        if (values.length === 0) {
          acc.UNKNOWN = (acc.UNKNOWN || 0) + 1;
          return acc;
        }
        for (const value of values) {
          if (typeof value === 'string' && value.length > 0) {
            acc[value] = (acc[value] || 0) + 1;
          }
        }
        return acc;
      }, {}),
    };

    lines.push('');
    lines.push('## Aggregate');
    lines.push('');
    lines.push(`- Total Locks: ${aggregate.totalLocks}`);
    lines.push(`- Total Overrides: ${aggregate.totalOverrides}`);
    lines.push(`- Gate Verdicts: ${JSON.stringify(aggregate.gateVerdicts)}`);
    lines.push(`- Threshold Profiles: ${JSON.stringify(aggregate.thresholdProfiles)}`);
    lines.push(`- Gate Policy Levels: ${JSON.stringify(aggregate.gatePolicyLevels)}`);
    lines.push(`- Publish Actions: ${JSON.stringify(aggregate.publishActions)}`);
    lines.push(`- Publish Eligibility: ${JSON.stringify(aggregate.publishEligibility)}`);
    lines.push(`- Policy Stages: ${JSON.stringify(aggregate.policyStages)}`);
    lines.push(`- Gate Reasons: ${JSON.stringify(aggregate.gateReasons)}`);
    lines.push(`- Continuity Sources: ${JSON.stringify(aggregate.continuitySources)}`);
    lines.push(`- Continuity Resolution Modes: ${JSON.stringify(aggregate.continuityResolutionModes)}`);
    lines.push(`- Continuity Lifecycle Stages: ${JSON.stringify(aggregate.continuityLifecycleStages)}`);
    lines.push(`- Continuity Transition Types: ${JSON.stringify(aggregate.continuityTransitionTypes)}`);
    lines.push(`- Continuity Previous Sources: ${JSON.stringify(aggregate.continuityPreviousSources)}`);
    lines.push(`- Continuity Freshness: ${JSON.stringify(aggregate.continuityFreshness)}`);
    lines.push(`- Coverage Roles: ${JSON.stringify(aggregate.coverageRoles)}`);
    lines.push(`- Rhythm Classes: ${JSON.stringify(aggregate.rhythmClasses)}`);
    lines.push(`- Planner Versions: ${JSON.stringify(aggregate.plannerVersions)}`);
    lines.push(`- Shot Planner Rule Set Versions: ${JSON.stringify(aggregate.shotPlannerRuleSetVersions)}`);
    lines.push(`- Shot Planner Matched Rule IDs: ${JSON.stringify(aggregate.shotPlannerMatchedRuleIds)}`);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
    const jsonOutputPath = outputPath.replace(/\.md$/i, '.json');
    const evidencePackage = {
      verdict: sceneEvidenceRows.every((row) => row.verdict === 'PASS') ? 'PASS' : 'FAIL',
      generatedAt: new Date().toISOString(),
      profile,
      totalScenes: sceneEvidenceRows.length,
      passedScenes: sceneEvidenceRows.filter((row) => row.verdict === 'PASS').length,
      failedScenes: sceneEvidenceRows.filter((row) => row.verdict !== 'PASS').length,
      aggregate,
      scenes: sceneEvidenceRows,
    };
    fs.writeFileSync(jsonOutputPath, `${JSON.stringify(evidencePackage, null, 2)}\n`, 'utf8');
    console.log(
      JSON.stringify(
        { verdict: 'REPORT_WRITTEN', outputPath, jsonOutputPath, summary: evidencePackage.verdict },
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
