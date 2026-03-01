/*
  Warnings:

  - You are about to drop the column `summary_vector` on the `novel_chapters` table. All the data in the column will be lost.
  - You are about to drop the column `enrichedText` on the `scenes` table. All the data in the column will be lost.
  - You are about to drop the column `index` on the `scenes` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `scenes` table. All the data in the column will be lost.
  - You are about to drop the column `visualDensityScore` on the `scenes` table. All the data in the column will be lost.
  - You are about to drop the `novel_scenes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `novel_sources` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[chapter_id,scene_index]` on the table `scenes` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `scene_index` to the `scenes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `scenes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetType" ADD VALUE 'AUDIO_TTS';
ALTER TYPE "AssetType" ADD VALUE 'AUDIO_BGM';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'CE11_SHOT_GENERATOR';
ALTER TYPE "JobType" ADD VALUE 'AUDIO';

-- DropForeignKey
ALTER TABLE "novel_analysis_jobs" DROP CONSTRAINT "novel_analysis_jobs_novelSourceId_fkey";

-- DropForeignKey
ALTER TABLE "novel_chapters" DROP CONSTRAINT "novel_chapters_novel_source_id_fkey";

-- DropForeignKey
ALTER TABLE "novel_scenes" DROP CONSTRAINT "novel_scenes_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "novel_sources" DROP CONSTRAINT "novel_sources_projectId_fkey";

-- DropForeignKey
ALTER TABLE "novel_volumes" DROP CONSTRAINT "novel_volumes_novel_source_id_fkey";

-- DropForeignKey
ALTER TABLE "quality_scores" DROP CONSTRAINT "quality_scores_shotId_fkey";

-- DropIndex
DROP INDEX "scenes_projectId_index_idx";

-- AlterTable
ALTER TABLE "novel_chapters" DROP COLUMN "summary_vector",
ADD COLUMN     "raw_content" TEXT;

-- AlterTable
ALTER TABLE "quality_scores" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rework_job_id" TEXT,
ADD COLUMN     "signals" JSONB DEFAULT '{}',
ADD COLUMN     "verdict" TEXT NOT NULL DEFAULT 'PASS',
ALTER COLUMN "visualDensityScore" DROP NOT NULL,
ALTER COLUMN "consistencyScore" DROP NOT NULL,
ALTER COLUMN "motionScore" DROP NOT NULL,
ALTER COLUMN "clarityScore" DROP NOT NULL,
ALTER COLUMN "aestheticScore" DROP NOT NULL;

-- AlterTable
ALTER TABLE "scenes" DROP COLUMN "enrichedText",
DROP COLUMN "index",
DROP COLUMN "projectId",
DROP COLUMN "visualDensityScore",
ADD COLUMN     "chapter_id" TEXT,
ADD COLUMN     "character_ids" JSONB,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "directing_notes" TEXT,
ADD COLUMN     "enriched_text" TEXT,
ADD COLUMN     "environment_tags" TEXT[],
ADD COLUMN     "location_slug" TEXT,
ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "scene_index" INTEGER NOT NULL,
ADD COLUMN     "shot_type" TEXT DEFAULT 'MEDIUM_SHOT',
ADD COLUMN     "status" TEXT DEFAULT 'PENDING',
ADD COLUMN     "time_of_day" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "visual_density_meta" JSONB,
ADD COLUMN     "visual_density_score" DECIMAL(65,30),
ALTER COLUMN "episodeId" DROP NOT NULL,
ALTER COLUMN "title" DROP NOT NULL;

-- DropTable
DROP TABLE "novel_scenes";

-- DropTable
DROP TABLE "novel_sources";

-- CreateTable
CREATE TABLE "novels" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "organization_id" TEXT,
    "raw_file_url" TEXT,
    "total_tokens" BIGINT DEFAULT 0,
    "status" TEXT DEFAULT 'UPLOADING',
    "metadata" JSONB,
    "file_name" TEXT,
    "file_size" INTEGER,
    "file_type" TEXT,
    "character_count" INTEGER,
    "chapter_count" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_anchors" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "reference_asset_id" TEXT NOT NULL,
    "identity_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_anchors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shot_identity_scores" (
    "id" TEXT NOT NULL,
    "shot_id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "reference_anchor_id" TEXT NOT NULL,
    "target_asset_id" TEXT NOT NULL,
    "identity_score" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shot_identity_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shot_rework_dedupe" (
    "id" TEXT NOT NULL,
    "rework_key" TEXT NOT NULL,
    "trace_id" TEXT,
    "shot_id" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shot_rework_dedupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_memories" (
    "id" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "memory_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_memories" (
    "id" TEXT NOT NULL,
    "scene_id" TEXT NOT NULL,
    "memory_type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "novels_project_id_key" ON "novels"("project_id");

-- CreateIndex
CREATE INDEX "idx_novels_project" ON "novels"("project_id");

-- CreateIndex
CREATE INDEX "identity_anchors_project_id_character_id_idx" ON "identity_anchors"("project_id", "character_id");

-- CreateIndex
CREATE INDEX "identity_anchors_reference_asset_id_idx" ON "identity_anchors"("reference_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_anchors_project_id_character_id_identity_hash_key" ON "identity_anchors"("project_id", "character_id", "identity_hash");

-- CreateIndex
CREATE INDEX "shot_identity_scores_shot_id_idx" ON "shot_identity_scores"("shot_id");

-- CreateIndex
CREATE INDEX "shot_identity_scores_reference_anchor_id_idx" ON "shot_identity_scores"("reference_anchor_id");

-- CreateIndex
CREATE INDEX "shot_identity_scores_character_id_idx" ON "shot_identity_scores"("character_id");

-- CreateIndex
CREATE INDEX "shot_identity_scores_created_at_idx" ON "shot_identity_scores"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "shot_rework_dedupe_rework_key_key" ON "shot_rework_dedupe"("rework_key");

-- CreateIndex
CREATE INDEX "character_memories_character_id_created_at_idx" ON "character_memories"("character_id", "created_at");

-- CreateIndex
CREATE INDEX "character_memories_scene_id_created_at_idx" ON "character_memories"("scene_id", "created_at");

-- CreateIndex
CREATE INDEX "scene_memories_scene_id_created_at_idx" ON "scene_memories"("scene_id", "created_at");

-- CreateIndex
CREATE INDEX "quality_scores_shotId_idx" ON "quality_scores"("shotId");

-- CreateIndex
CREATE INDEX "scenes_project_id_scene_index_idx" ON "scenes"("project_id", "scene_index");

-- CreateIndex
CREATE UNIQUE INDEX "scenes_chapter_id_scene_index_key" ON "scenes"("chapter_id", "scene_index");

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "novel_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_scores" ADD CONSTRAINT "quality_scores_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novels" ADD CONSTRAINT "novels_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_analysis_jobs" ADD CONSTRAINT "novel_analysis_jobs_novelSourceId_fkey" FOREIGN KEY ("novelSourceId") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_volumes" ADD CONSTRAINT "novel_volumes_novel_source_id_fkey" FOREIGN KEY ("novel_source_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_chapters" ADD CONSTRAINT "novel_chapters_novel_source_id_fkey" FOREIGN KEY ("novel_source_id") REFERENCES "novels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_identity_scores" ADD CONSTRAINT "shot_identity_scores_reference_anchor_id_fkey" FOREIGN KEY ("reference_anchor_id") REFERENCES "identity_anchors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
