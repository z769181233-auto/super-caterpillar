/*
  Warnings:

  - You are about to drop the column `data` on the `shot_variants` table. All the data in the column will be lost.
  - The `status` column on the `video_jobs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `ShotJob` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `video_jobs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "video_job_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "shot_status" ADD VALUE 'RENDERING';
ALTER TYPE "shot_status" ADD VALUE 'DONE';

-- DropForeignKey
ALTER TABLE "ShotJob" DROP CONSTRAINT "ShotJob_episodeId_fkey";

-- DropForeignKey
ALTER TABLE "ShotJob" DROP CONSTRAINT "ShotJob_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ShotJob" DROP CONSTRAINT "ShotJob_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ShotJob" DROP CONSTRAINT "ShotJob_sceneId_fkey";

-- DropForeignKey
ALTER TABLE "ShotJob" DROP CONSTRAINT "ShotJob_shotId_fkey";

-- DropForeignKey
ALTER TABLE "ShotJob" DROP CONSTRAINT "ShotJob_taskId_fkey";

-- DropForeignKey
ALTER TABLE "ShotJob" DROP CONSTRAINT "ShotJob_workerId_fkey";

-- DropForeignKey
ALTER TABLE "assets" DROP CONSTRAINT "assets_createdByJobId_fkey";

-- DropForeignKey
ALTER TABLE "job_engine_bindings" DROP CONSTRAINT "job_engine_bindings_jobId_fkey";

-- AlterTable
ALTER TABLE "shot_variants" DROP COLUMN "data",
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedByUserId" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "parameters" JSONB,
ADD COLUMN     "qualityScore" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "shots" ADD COLUMN     "currentVariantId" TEXT,
ADD COLUMN     "status" "shot_status" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "video_jobs" ADD COLUMN     "creditReservationId" TEXT,
ADD COLUMN     "gpuSecondsActual" INTEGER DEFAULT 0,
ADD COLUMN     "gpuSecondsEstimated" INTEGER DEFAULT 0,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "reservedAt" TIMESTAMP(3),
ADD COLUMN     "reservedCredits" INTEGER DEFAULT 0,
ADD COLUMN     "settledAt" TIMESTAMP(3),
ADD COLUMN     "settledCredits" INTEGER DEFAULT 0,
ADD COLUMN     "variantId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "video_job_status" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "payload" SET DEFAULT '{}';

-- DropTable
DROP TABLE "ShotJob";

-- CreateTable
CREATE TABLE "shot_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "shotId" TEXT NOT NULL,
    "taskId" TEXT,
    "workerId" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "type" "JobType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxRetry" INTEGER NOT NULL DEFAULT 3,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "engineConfig" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "traceId" TEXT,

    CONSTRAINT "shot_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shot_jobs_status_createdAt_idx" ON "shot_jobs"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "video_jobs_idempotencyKey_key" ON "video_jobs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "video_jobs_status_createdAt_idx" ON "video_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "worker_nodes_status_lastHeartbeat_idx" ON "worker_nodes"("status", "lastHeartbeat");

-- AddForeignKey
ALTER TABLE "job_engine_bindings" ADD CONSTRAINT "job_engine_bindings_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "shot_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "shots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shot_jobs" ADD CONSTRAINT "shot_jobs_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_createdByJobId_fkey" FOREIGN KEY ("createdByJobId") REFERENCES "shot_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
