-- Create billing_outbox table
CREATE TABLE "BillingOutbox" (
    "id" TEXT PRIMARY KEY,
    "dedupeKey" TEXT UNIQUE NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, FAILED
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Index for scanning pending events
CREATE INDEX "BillingOutbox_status_nextRetryAt_idx" ON "BillingOutbox"("status", "nextRetryAt");
