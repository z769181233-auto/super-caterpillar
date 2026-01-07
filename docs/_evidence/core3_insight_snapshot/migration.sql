-- CreateEnum
CREATE TYPE "NovelInsightStatus" AS ENUM ('INIT', 'GENERATED', 'FAILED');

-- CreateTable
CREATE TABLE "novel_insight_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "novelSourceId" TEXT NOT NULL,
    "jobId" TEXT,
    "traceId" TEXT,
    "engineVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT 'v1',
    "status" "NovelInsightStatus" NOT NULL DEFAULT 'INIT',
    "summaryJson" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novel_insight_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "novel_insight_snapshots_projectId_idx" ON "novel_insight_snapshots"("projectId");

-- CreateIndex
CREATE INDEX "novel_insight_snapshots_novelSourceId_idx" ON "novel_insight_snapshots"("novelSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "novel_insight_snapshots_novelSourceId_engineVersion_key" ON "novel_insight_snapshots"("novelSourceId", "engineVersion");

-- AddForeignKey
ALTER TABLE "novel_insight_snapshots" ADD CONSTRAINT "novel_insight_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_insight_snapshots" ADD CONSTRAINT "novel_insight_snapshots_novelSourceId_fkey" FOREIGN KEY ("novelSourceId") REFERENCES "novel_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
