-- CreateExtension
-- CREATE EXTENSION IF NOT EXISTS vector; -- Commented out for P6-1 (pgvector not available)

-- CreateEnum
CREATE TYPE "ShotRenderStatus" AS ENUM ('PENDING', 'RENDERING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "novel_chapters" ADD COLUMN     "summary_vector" vector,
ADD COLUMN     "visual_density_score" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "novel_scenes" ADD COLUMN     "environment_tags" TEXT[],
ADD COLUMN     "graph_state_snapshot" JSONB,
ADD COLUMN     "location_slug" TEXT,
ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "time_of_day" TEXT;

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "graph_state_snapshot" JSONB;

-- AlterTable
ALTER TABLE "shots" ADD COLUMN     "action_description" TEXT,
ADD COLUMN     "asset_bindings" JSONB,
ADD COLUMN     "camera_angle" TEXT,
ADD COLUMN     "camera_movement" TEXT,
ADD COLUMN     "controlnet_settings" JSONB,
ADD COLUMN     "dialogue_content" TEXT,
ADD COLUMN     "duration_sec" DECIMAL(65,30),
ADD COLUMN     "lighting_preset" TEXT,
ADD COLUMN     "negative_prompt" TEXT,
ADD COLUMN     "render_status" "ShotRenderStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "result_image_url" TEXT,
ADD COLUMN     "result_video_url" TEXT,
ADD COLUMN     "shot_type" TEXT,
ADD COLUMN     "sound_fx" TEXT,
ADD COLUMN     "visual_prompt" TEXT;

-- CreateTable
CREATE TABLE "BillingOutbox" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingOutbox_dedupeKey_key" ON "BillingOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "idx_shots_director_controls" ON "shots"("shot_type", "camera_movement", "camera_angle", "lighting_preset");
