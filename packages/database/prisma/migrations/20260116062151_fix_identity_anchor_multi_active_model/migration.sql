/*
  Warnings:

  - You are about to drop the column `character_count` on the `novel_chapters` table. All the data in the column will be lost.
  - You are about to drop the column `end_paragraph` on the `novel_chapters` table. All the data in the column will be lost.
  - You are about to drop the column `novelSourceId` on the `novel_chapters` table. All the data in the column will be lost.
  - You are about to drop the column `novel_volume_id` on the `novel_chapters` table. All the data in the column will be lost.
  - You are about to drop the column `orderIndex` on the `novel_chapters` table. All the data in the column will be lost.
  - You are about to drop the column `raw_text` on the `novel_chapters` table. All the data in the column will be lost.
  - You are about to drop the column `start_paragraph` on the `novel_chapters` table. All the data in the column will be lost.
  - You are about to drop the column `chapters` on the `novel_parse_results` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `novel_parse_results` table. All the data in the column will be lost.
  - You are about to drop the column `parsingQuality` on the `novel_parse_results` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `novel_parse_results` table. All the data in the column will be lost.
  - You are about to drop the column `scenes` on the `novel_parse_results` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `novel_parse_results` table. All the data in the column will be lost.
  - You are about to drop the column `volumes` on the `novel_parse_results` table. All the data in the column will be lost.
  - You are about to drop the column `chunk_index` on the `novel_scenes` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `novel_volumes` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `novel_volumes` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `novel_volumes` table. All the data in the column will be lost.
  - You are about to drop the column `orderIndex` on the `scene_drafts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[dedupe_key]` on the table `Task` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[volume_id,index]` on the table `novel_chapters` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[project_id]` on the table `novel_parse_results` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotency_key]` on the table `novel_parse_results` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[chapter_id,index]` on the table `novel_scenes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[project_id,index]` on the table `novel_volumes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[chapterId,index]` on the table `scene_drafts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[dedupe_key]` on the table `shot_jobs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `index` to the `novel_chapters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `novel_source_id` to the `novel_chapters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `volume_id` to the `novel_chapters` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idempotency_key` to the `novel_parse_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `novel_parse_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `project_id` to the `novel_parse_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `novel_parse_results` table without a default value. This is not possible if the table is not empty.
  - Added the required column `project_id` to the `novel_volumes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `novel_volumes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `index` to the `scene_drafts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'NOVEL_SCAN_TOC';
ALTER TYPE "JobType" ADD VALUE 'NOVEL_CHUNK_PARSE';
ALTER TYPE "JobType" ADD VALUE 'PIPELINE_STAGE1_NOVEL_TO_VIDEO';
ALTER TYPE "JobType" ADD VALUE 'PIPELINE_PROD_VIDEO_V1';

-- DropForeignKey
ALTER TABLE "novel_chapters" DROP CONSTRAINT "novel_chapters_novelSourceId_fkey";

-- DropForeignKey
ALTER TABLE "novel_chapters" DROP CONSTRAINT "novel_chapters_novel_volume_id_fkey";

-- DropForeignKey
ALTER TABLE "novel_parse_results" DROP CONSTRAINT "novel_parse_results_projectId_fkey";

-- DropIndex
DROP INDEX "novel_chapters_novelSourceId_idx";

-- DropIndex
DROP INDEX "novel_chapters_novelSourceId_orderIndex_key";

-- DropIndex
DROP INDEX "novel_parse_results_projectId_idx";

-- DropIndex
DROP INDEX "novel_parse_results_projectId_key";

-- DropIndex
DROP INDEX "novel_scenes_chapter_id_index_idx";

-- DropIndex
DROP INDEX "novel_scenes_chunk_index_idx";

-- DropIndex
DROP INDEX "scene_drafts_chapterId_orderIndex_key";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "dedupe_key" TEXT,
ADD COLUMN     "is_verification" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "novel_chapters" DROP COLUMN "character_count",
DROP COLUMN "end_paragraph",
DROP COLUMN "novelSourceId",
DROP COLUMN "novel_volume_id",
DROP COLUMN "orderIndex",
DROP COLUMN "raw_text",
DROP COLUMN "start_paragraph",
ADD COLUMN     "index" INTEGER NOT NULL,
ADD COLUMN     "is_system_controlled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "novel_source_id" TEXT NOT NULL,
ADD COLUMN     "volume_id" TEXT NOT NULL,
ALTER COLUMN "title" DROP NOT NULL;

-- AlterTable
ALTER TABLE "novel_parse_results" DROP COLUMN "chapters",
DROP COLUMN "createdAt",
DROP COLUMN "parsingQuality",
DROP COLUMN "projectId",
DROP COLUMN "scenes",
DROP COLUMN "updatedAt",
DROP COLUMN "volumes",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "idempotency_key" TEXT NOT NULL,
ADD COLUMN     "model_version" TEXT,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "parsing_quality" DOUBLE PRECISION,
ADD COLUMN     "project_id" TEXT NOT NULL,
ADD COLUMN     "raw_output" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "novel_scenes" DROP COLUMN "chunk_index",
ADD COLUMN     "directing_notes" TEXT,
ADD COLUMN     "shot_type" TEXT DEFAULT 'MEDIUM_SHOT',
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "novel_volumes" DROP COLUMN "createdAt",
DROP COLUMN "projectId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "project_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "title" DROP NOT NULL;

-- AlterTable
ALTER TABLE "scene_drafts" DROP COLUMN "orderIndex",
ADD COLUMN     "index" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "shot_jobs" ADD COLUMN     "dedupe_key" TEXT,
ADD COLUMN     "is_verification" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "episodeId" DROP NOT NULL,
ALTER COLUMN "sceneId" DROP NOT NULL,
ALTER COLUMN "shotId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "character_identity_anchors" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "provider" TEXT,
    "seed" INTEGER,
    "viewKeyFront" TEXT,
    "viewKeySide" TEXT,
    "viewKeyBack" TEXT,
    "viewKeysSha256" TEXT,
    "traceId" TEXT,
    "lastError" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_identity_anchors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_videos" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "published_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_identity_anchors_characterId_idx" ON "character_identity_anchors"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "published_videos_assetId_key" ON "published_videos"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_dedupe_key_key" ON "Task"("dedupe_key");

-- CreateIndex
CREATE INDEX "billing_events_org_id_created_at_idx" ON "billing_events"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "novel_chapters_volume_id_index_key" ON "novel_chapters"("volume_id", "index");

-- CreateIndex
CREATE UNIQUE INDEX "novel_parse_results_project_id_key" ON "novel_parse_results"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "novel_parse_results_idempotency_key_key" ON "novel_parse_results"("idempotency_key");

-- CreateIndex
CREATE INDEX "novel_parse_results_project_id_idx" ON "novel_parse_results"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "novel_scenes_chapter_id_index_key" ON "novel_scenes"("chapter_id", "index");

-- CreateIndex
CREATE UNIQUE INDEX "novel_volumes_project_id_index_key" ON "novel_volumes"("project_id", "index");

-- CreateIndex
CREATE UNIQUE INDEX "scene_drafts_chapterId_index_key" ON "scene_drafts"("chapterId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "shot_jobs_dedupe_key_key" ON "shot_jobs"("dedupe_key");

-- AddForeignKey
ALTER TABLE "novel_volumes" ADD CONSTRAINT "novel_volumes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_chapters" ADD CONSTRAINT "novel_chapters_volume_id_fkey" FOREIGN KEY ("volume_id") REFERENCES "novel_volumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_chapters" ADD CONSTRAINT "novel_chapters_novel_source_id_fkey" FOREIGN KEY ("novel_source_id") REFERENCES "novel_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_parse_results" ADD CONSTRAINT "novel_parse_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_parse_results" ADD CONSTRAINT "novel_parse_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_videos" ADD CONSTRAINT "published_videos_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_videos" ADD CONSTRAINT "published_videos_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_videos" ADD CONSTRAINT "published_videos_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
