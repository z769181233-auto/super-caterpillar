-- Local canonical DB alignment for Film IR on 5432/scu.
-- Keep this migration narrowly scoped to the current Film IR runtime surface:
-- - enum values required by job/task creation
-- - scene/shot back-reference columns
-- - film_ir / continuity_states / continuity_violations / content_gate_results tables

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'film_ir_status') THEN
    CREATE TYPE "film_ir_status" AS ENUM ('DRAFT', 'APPROVED', 'LOCKED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'JobType' AND e.enumlabel = 'CE_FILM_IR_PLAN'
  ) THEN
    ALTER TYPE "JobType" ADD VALUE 'CE_FILM_IR_PLAN';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'JobType' AND e.enumlabel = 'CE_SHOT_PLAN'
  ) THEN
    ALTER TYPE "JobType" ADD VALUE 'CE_SHOT_PLAN';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'JobType' AND e.enumlabel = 'CE_CONSISTENCY_CHECK'
  ) THEN
    ALTER TYPE "JobType" ADD VALUE 'CE_CONSISTENCY_CHECK';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'JobType' AND e.enumlabel = 'CE_CONTENT_JUDGE'
  ) THEN
    ALTER TYPE "JobType" ADD VALUE 'CE_CONTENT_JUDGE';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskType') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'TaskType' AND e.enumlabel = 'CE_FILM_IR_PLAN'
    ) THEN
      ALTER TYPE "TaskType" ADD VALUE 'CE_FILM_IR_PLAN';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'TaskType' AND e.enumlabel = 'CE_SHOT_PLAN'
    ) THEN
      ALTER TYPE "TaskType" ADD VALUE 'CE_SHOT_PLAN';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'TaskType' AND e.enumlabel = 'CE_CONSISTENCY_CHECK'
    ) THEN
      ALTER TYPE "TaskType" ADD VALUE 'CE_CONSISTENCY_CHECK';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'TaskType' AND e.enumlabel = 'CE_CONTENT_JUDGE'
    ) THEN
      ALTER TYPE "TaskType" ADD VALUE 'CE_CONTENT_JUDGE';
    END IF;
  END IF;
END
$$;

ALTER TABLE "scenes"
  ADD COLUMN IF NOT EXISTS "film_ir_id" TEXT;

ALTER TABLE "shots"
  ADD COLUMN IF NOT EXISTS "film_ir_id" TEXT,
  ADD COLUMN IF NOT EXISTS "dramatic_function" TEXT,
  ADD COLUMN IF NOT EXISTS "emotional_target" TEXT;

CREATE TABLE IF NOT EXISTS "film_ir" (
  "id" TEXT NOT NULL,
  "scene_id" TEXT,
  "project_id" TEXT NOT NULL,
  "planner_version" TEXT NOT NULL DEFAULT 'film-planner-v1',
  "status" "film_ir_status" NOT NULL DEFAULT 'DRAFT',
  "source_text" TEXT,
  "source_context_summary" TEXT,
  "dramatic_function" TEXT,
  "dramatic_goal" TEXT,
  "emotional_target" TEXT,
  "tension_curve" TEXT,
  "pov_character" TEXT,
  "audience_information_mode" TEXT,
  "relationship_before" TEXT,
  "relationship_after" TEXT,
  "visual_strategy" TEXT,
  "blocking_strategy" TEXT,
  "shot_pattern" TEXT,
  "avg_shot_length_sec" DECIMAL(65,30),
  "camera_distance_strategy" TEXT,
  "camera_angle_strategy" TEXT,
  "camera_motion_style" TEXT,
  "composition_style" TEXT,
  "spatial_strategy" TEXT,
  "lighting_style" TEXT,
  "color_strategy" TEXT,
  "sound_strategy" TEXT,
  "silence_strategy" TEXT,
  "editing_rhythm_strategy" TEXT,
  "continuity_constraints" JSONB,
  "character_state_constraints" JSONB,
  "costume_state_constraints" JSONB,
  "prop_state_constraints" JSONB,
  "location_state_constraints" JSONB,
  "why_this_choice" TEXT,
  "alternative_rejected_reason" TEXT,
  "quality_score" DECIMAL(65,30),
  "confidence" DECIMAL(65,30),
  "evidence_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "film_ir_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "continuity_states" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "at_scene_id" TEXT NOT NULL,
  "at_shot_id" TEXT,
  "state_data" JSONB NOT NULL,
  "is_locked" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL DEFAULT 'FILM_IR',
  "violation_flag" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "continuity_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "continuity_violations" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "from_scene_id" TEXT,
  "to_scene_id" TEXT,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "violation_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'WARNING',
  "description" TEXT,
  "auto_resolved" BOOLEAN NOT NULL DEFAULT false,
  "evidence_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "continuity_violations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "content_gate_results" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "scene_id" TEXT,
  "episode_id" TEXT,
  "film_ir_id" TEXT,
  "gate_version" TEXT NOT NULL DEFAULT 'content-judge-v1',
  "dramatic_alignment_score" DECIMAL(65,30),
  "visual_strategy_match_score" DECIMAL(65,30),
  "continuity_score" DECIMAL(65,30),
  "shot_coherence_score" DECIMAL(65,30),
  "rhythm_score" DECIMAL(65,30),
  "character_consistency_score" DECIMAL(65,30),
  "sound_alignment_score" DECIMAL(65,30),
  "publish_readiness_score" DECIMAL(65,30),
  "gate_verdict" TEXT NOT NULL DEFAULT 'PENDING',
  "gate_details" JSONB,
  "evidence_ref" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "content_gate_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "film_ir_project_id_idx" ON "film_ir"("project_id");
CREATE INDEX IF NOT EXISTS "film_ir_status_idx" ON "film_ir"("status");
CREATE INDEX IF NOT EXISTS "film_ir_planner_version_idx" ON "film_ir"("planner_version");
CREATE UNIQUE INDEX IF NOT EXISTS "film_ir_scene_id_planner_version_key" ON "film_ir"("scene_id", "planner_version");

CREATE INDEX IF NOT EXISTS "continuity_states_project_id_entity_type_idx" ON "continuity_states"("project_id", "entity_type");
CREATE INDEX IF NOT EXISTS "continuity_states_at_scene_id_idx" ON "continuity_states"("at_scene_id");
CREATE INDEX IF NOT EXISTS "continuity_states_entity_id_idx" ON "continuity_states"("entity_id");
CREATE UNIQUE INDEX IF NOT EXISTS "continuity_states_project_id_entity_type_entity_id_at_scene_key"
  ON "continuity_states"("project_id", "entity_type", "entity_id", "at_scene_id");

CREATE INDEX IF NOT EXISTS "continuity_violations_project_id_severity_idx" ON "continuity_violations"("project_id", "severity");
CREATE INDEX IF NOT EXISTS "continuity_violations_from_scene_id_to_scene_id_idx" ON "continuity_violations"("from_scene_id", "to_scene_id");
CREATE INDEX IF NOT EXISTS "continuity_violations_entity_type_entity_id_idx" ON "continuity_violations"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "content_gate_results_project_id_gate_verdict_idx" ON "content_gate_results"("project_id", "gate_verdict");
CREATE INDEX IF NOT EXISTS "content_gate_results_scene_id_idx" ON "content_gate_results"("scene_id");
CREATE INDEX IF NOT EXISTS "content_gate_results_episode_id_idx" ON "content_gate_results"("episode_id");
CREATE INDEX IF NOT EXISTS "content_gate_results_film_ir_id_idx" ON "content_gate_results"("film_ir_id");

CREATE UNIQUE INDEX IF NOT EXISTS "scenes_film_ir_id_key" ON "scenes"("film_ir_id");
CREATE INDEX IF NOT EXISTS "idx_shots_film_ir_id" ON "shots"("film_ir_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'film_ir_project_id_fkey'
  ) THEN
    ALTER TABLE "film_ir"
      ADD CONSTRAINT "film_ir_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scenes_film_ir_id_fkey'
  ) THEN
    ALTER TABLE "scenes"
      ADD CONSTRAINT "scenes_film_ir_id_fkey"
      FOREIGN KEY ("film_ir_id") REFERENCES "film_ir"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
