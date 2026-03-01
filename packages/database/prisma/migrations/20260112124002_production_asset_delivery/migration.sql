/*
  Warnings:

  - You are about to drop the column `securityProcessed` on the `video_jobs` table. All the data in the column will be lost.
  - Added the required column `novel_source_id` to the `novel_volumes` table without a default value. This is not possible if the table is not empty.
  - Made the column `projectId` on table `scenes` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ShotReviewStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'FINALIZED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JobType" ADD VALUE 'PIPELINE_E2E_VIDEO';
ALTER TYPE "JobType" ADD VALUE 'PIPELINE_TIMELINE_COMPOSE';
ALTER TYPE "JobType" ADD VALUE 'TIMELINE_RENDER';
ALTER TYPE "JobType" ADD VALUE 'TIMELINE_PREVIEW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskType" ADD VALUE 'PIPELINE_TIMELINE_COMPOSE';
ALTER TYPE "TaskType" ADD VALUE 'TIMELINE_RENDER';
ALTER TYPE "TaskType" ADD VALUE 'PIPELINE_E2E_VIDEO';

-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "Asset_Shot_fkey";

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "fingerprint_id" TEXT,
ADD COLUMN     "hls_playlist_url" TEXT,
ADD COLUMN     "shotId" TEXT,
ADD COLUMN     "signed_url" TEXT,
ADD COLUMN     "watermark_mode" TEXT;

-- AlterTable
ALTER TABLE "novel_chapters" ADD COLUMN     "novel_volume_id" TEXT;

-- AlterTable
ALTER TABLE "novel_volumes" ADD COLUMN     "novel_source_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "scenes" ADD COLUMN     "reviewStatus" "ShotReviewStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "projectId" SET NOT NULL;

-- AlterTable
ALTER TABLE "shot_jobs" ADD COLUMN     "securityProcessed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shots" ADD COLUMN     "reviewStatus" "ShotReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "video_jobs" DROP COLUMN "securityProcessed",
ADD COLUMN     "security_processed" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "shot_review_status";

-- CreateIndex
CREATE INDEX "assets_shotId_idx" ON "assets"("shotId");

-- AddForeignKey
ALTER TABLE "novel_chapters" ADD CONSTRAINT "novel_chapters_novel_volume_id_fkey" FOREIGN KEY ("novel_volume_id") REFERENCES "novel_volumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_volumes" ADD CONSTRAINT "novel_volumes_novel_source_id_fkey" FOREIGN KEY ("novel_source_id") REFERENCES "novel_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_fingerprint_id_fkey" FOREIGN KEY ("fingerprint_id") REFERENCES "security_fingerprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
