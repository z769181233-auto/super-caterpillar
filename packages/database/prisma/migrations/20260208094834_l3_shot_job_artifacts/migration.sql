-- CreateTable: ShotJobArtifacts for L3 DB Traceability
CREATE TABLE "shot_job_artifacts" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shot_job_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shot_job_artifacts_job_id_idx" ON "shot_job_artifacts"("job_id");

-- CreateIndex
CREATE INDEX "shot_job_artifacts_kind_idx" ON "shot_job_artifacts"("kind");

-- AddForeignKey
ALTER TABLE "shot_job_artifacts" ADD CONSTRAINT "shot_job_artifacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "shot_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
