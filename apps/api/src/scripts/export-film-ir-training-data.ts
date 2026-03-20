import { PrismaClient } from 'database';
import * as fs from 'fs';
import * as path from 'path';

type JsonRecord = Record<string, unknown>;

const prisma = new PrismaClient({});

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJsonl(filePath: string, rows: JsonRecord[]) {
  const content = rows.map((row) => JSON.stringify(row)).join('\n');
  fs.writeFileSync(filePath, content ? `${content}\n` : '');
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    tableName,
  );
  return !!rows?.[0]?.exists;
}

async function main() {
  const outDir = path.join(process.cwd(), 'storage/exports', 'film_ir_dataset');
  ensureDir(outDir);

  const filmIrs = await prisma.filmIR.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      sceneRef: {
        include: {
          shots: {
            orderBy: { index: 'asc' },
            include: {
              shotPlanning: true,
            },
          },
        },
      },
    },
  });

  const gateResults = await prisma.contentGateResult.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const scriptToDirectingRows: JsonRecord[] = [];
  const directingToShotPlanRows: JsonRecord[] = [];
  const judgeRows: JsonRecord[] = [];

  for (const filmIr of filmIrs) {
    scriptToDirectingRows.push({
      sample_type: 'script_to_directing',
      scene_id: filmIr.sceneId,
      project_id: filmIr.projectId,
      planner_version: filmIr.plannerVersion,
      status: filmIr.status,
      input: {
        source_text: filmIr.sourceText,
        source_context_summary: filmIr.sourceContextSummary,
      },
      target: {
        dramatic_function: filmIr.dramaticFunction,
        dramatic_goal: filmIr.dramaticGoal,
        emotional_target: filmIr.emotionalTarget,
        tension_curve: filmIr.tensionCurve,
        pov_character: filmIr.povCharacter,
        audience_information_mode: filmIr.audienceInformationMode,
        relationship_before: filmIr.relationshipBefore,
        relationship_after: filmIr.relationshipAfter,
        visual_strategy: filmIr.visualStrategy,
        blocking_strategy: filmIr.blockingStrategy,
        shot_pattern: filmIr.shotPattern,
        avg_shot_length_sec: filmIr.avgShotLengthSec?.toString() ?? null,
        camera_distance_strategy: filmIr.cameraDistanceStrategy,
        camera_angle_strategy: filmIr.cameraAngleStrategy,
        camera_motion_style: filmIr.cameraMotionStyle,
        composition_style: filmIr.compositionStyle,
        spatial_strategy: filmIr.spatialStrategy,
        lighting_style: filmIr.lightingStyle,
        color_strategy: filmIr.colorStrategy,
        sound_strategy: filmIr.soundStrategy,
        silence_strategy: filmIr.silenceStrategy,
        editing_rhythm_strategy: filmIr.editingRhythmStrategy,
        continuity_constraints: filmIr.continuityConstraints,
        character_state_constraints: filmIr.characterStateConstraints,
        costume_state_constraints: filmIr.costumeStateConstraints,
        prop_state_constraints: filmIr.propStateConstraints,
        location_state_constraints: filmIr.locationStateConstraints,
        why_this_choice: filmIr.whyThisChoice,
        alternative_rejected_reason: filmIr.alternativeRejectedReason,
        quality_score: filmIr.qualityScore?.toString() ?? null,
      },
      evidence_ref: filmIr.evidenceRef,
    });

    const shots = filmIr.sceneRef?.shots ?? [];
    if (shots.length > 0) {
      directingToShotPlanRows.push({
        sample_type: 'directing_to_shot_plan',
        scene_id: filmIr.sceneId,
        film_ir_id: filmIr.id,
        planner_version: filmIr.plannerVersion,
        input: {
          dramatic_function: filmIr.dramaticFunction,
          dramatic_goal: filmIr.dramaticGoal,
          emotional_target: filmIr.emotionalTarget,
          visual_strategy: filmIr.visualStrategy,
          shot_pattern: filmIr.shotPattern,
          continuity_constraints: filmIr.continuityConstraints,
        },
        target: shots.map((shot) => ({
          shot_id: shot.id,
          index: shot.index,
          type: shot.type,
          novel_quote: shot.novelQuote,
          dramatic_function: shot.dramaticFunction,
          emotional_target: shot.emotionalTarget,
          planning: shot.shotPlanning?.data ?? null,
        })),
        evidence_ref: filmIr.evidenceRef,
      });
    }
  }

  for (const gate of gateResults) {
    judgeRows.push({
      sample_type: 'judge',
      gate_version: gate.gateVersion,
      project_id: gate.projectId,
      scene_id: gate.sceneId,
      episode_id: gate.episodeId,
      film_ir_id: gate.filmIrId,
      scores: {
        dramatic_alignment_score: gate.dramaticAlignmentScore?.toString() ?? null,
        visual_strategy_match_score: gate.visualStrategyMatchScore?.toString() ?? null,
        continuity_score: gate.continuityScore?.toString() ?? null,
        shot_coherence_score: gate.shotCoherenceScore?.toString() ?? null,
        rhythm_score: gate.rhythmScore?.toString() ?? null,
        character_consistency_score: gate.characterConsistencyScore?.toString() ?? null,
        sound_alignment_score: gate.soundAlignmentScore?.toString() ?? null,
        publish_readiness_score: gate.publishReadinessScore?.toString() ?? null,
      },
      verdict: gate.gateVerdict,
      details: gate.gateDetails,
      evidence_ref: gate.evidenceRef,
    });
  }

  writeJsonl(path.join(outDir, 'script_to_directing.jsonl'), scriptToDirectingRows);
  writeJsonl(path.join(outDir, 'directing_to_shot_plan.jsonl'), directingToShotPlanRows);
  writeJsonl(path.join(outDir, 'judge_samples.jsonl'), judgeRows);

  const exportManifest: JsonRecord = {
    exported_at: new Date().toISOString(),
    script_to_directing_count: scriptToDirectingRows.length,
    directing_to_shot_plan_count: directingToShotPlanRows.length,
    judge_samples_count: judgeRows.length,
    continuity_snapshot_table_present: await tableExists('continuity_state_snapshots'),
    content_gate_table_present: await tableExists('content_gate_results'),
    film_ir_runs_table_present: await tableExists('film_ir_runs'),
    output_dir: outDir,
  };

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(exportManifest, null, 2),
  );

  console.log(JSON.stringify(exportManifest, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
