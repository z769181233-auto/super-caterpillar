-- CreateTable
CREATE TABLE "translation_cache" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "sourceLang" TEXT NOT NULL,
    "targetLang" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "translation_cache_organizationId_idx" ON "translation_cache"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "translation_cache_provider_targetLang_inputHash_projectId_key" ON "translation_cache"("provider", "targetLang", "inputHash", "projectId");
