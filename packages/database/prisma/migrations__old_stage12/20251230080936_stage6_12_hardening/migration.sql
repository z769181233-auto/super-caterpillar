-- AlterTable
ALTER TABLE "shot_jobs" ADD COLUMN     "engineKey" TEXT;

-- CreateIndex
CREATE INDEX "shot_jobs_type_status_idx" ON "shot_jobs"("type", "status");

-- CreateIndex
CREATE INDEX "shot_jobs_engineKey_status_idx" ON "shot_jobs"("engineKey", "status");
