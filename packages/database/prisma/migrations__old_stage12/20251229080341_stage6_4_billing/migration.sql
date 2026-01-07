-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "billing_status" ADD VALUE 'reserved';
ALTER TYPE "billing_status" ADD VALUE 'settled';
ALTER TYPE "billing_status" ADD VALUE 'refunded';

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_skus" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "billing_status" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_ledgers" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "billing_status" NOT NULL,
    "refId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skus_code_key" ON "skus"("code");

-- CreateIndex
CREATE INDEX "asset_skus_status_createdAt_idx" ON "asset_skus"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "asset_skus_assetId_skuId_key" ON "asset_skus"("assetId", "skuId");

-- CreateIndex
CREATE INDEX "billing_ledgers_assetId_createdAt_idx" ON "billing_ledgers"("assetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "billing_ledgers_status_createdAt_idx" ON "billing_ledgers"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "asset_skus" ADD CONSTRAINT "asset_skus_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
