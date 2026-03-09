"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeNextRetry = computeNextRetry;
exports.markRetryOrFail = markRetryOrFail;
const database_1 = require("database");
function computeNextRetry(job) {
    const nextRetryCount = job.retryCount + 1;
    const shouldFail = nextRetryCount >= job.maxRetry;
    const baseDelayMs = 1000;
    const backoffMs = shouldFail ? 0 : baseDelayMs * Math.pow(2, nextRetryCount - 1);
    const nextRetryAt = shouldFail ? null : new Date(Date.now() + backoffMs);
    return {
        nextRetryCount,
        nextRetryAt,
        shouldFail,
        backoffMs,
    };
}
async function markRetryOrFail(tx, job, failPayload = {}) {
    const computation = computeNextRetry(job);
    const payload = job.payload || {};
    if (computation.shouldFail) {
        delete payload.nextRetryAt;
        delete payload.backoffDelayMs;
    }
    else {
        payload.nextRetryAt = computation.nextRetryAt?.toISOString();
        payload.backoffDelayMs = computation.backoffMs;
    }
    const status = computation.shouldFail ? database_1.JobStatus.FAILED : database_1.JobStatus.RETRYING;
    await tx.shotJob.update({
        where: { id: job.id, status: database_1.JobStatus.RUNNING },
        data: {
            status,
            payload: payload,
            lastError: failPayload.errorMessage || 'Processing failed',
            retryCount: computation.nextRetryCount,
            workerId: null,
            leaseUntil: null,
            lockedBy: null,
        },
    });
    try {
        await tx.billingLedger.create({
            data: {
                jobId: job.id,
                projectId: job.projectId,
                billingState: 'RELEASED',
                amount: 1n,
                idempotencyKey: `${job.id}_RELEASED`,
            },
        });
    }
    catch (e) {
        if (e.code === 'P2002') {
            console.warn(`[JobRetry] Billing idempotency hit: ${job.id}_RELEASED already exists`);
        }
        else {
            throw e;
        }
    }
    return {
        status,
        retryCount: computation.nextRetryCount,
        nextRetryAt: computation.nextRetryAt,
    };
}
//# sourceMappingURL=job.retry.js.map