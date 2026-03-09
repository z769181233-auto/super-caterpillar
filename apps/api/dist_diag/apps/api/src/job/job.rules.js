"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_TRANSITIONS = void 0;
exports.assertTransition = assertTransition;
exports.isTerminalStatus = isTerminalStatus;
exports.isClaimableStatus = isClaimableStatus;
exports.transitionJobStatus = transitionJobStatus;
exports.transitionJobStatusAdmin = transitionJobStatusAdmin;
const common_1 = require("@nestjs/common");
const database_1 = require("database");
const logger = new common_1.Logger('JobRules');
exports.ALLOWED_TRANSITIONS = {
    [database_1.JobStatus.PENDING]: [database_1.JobStatus.DISPATCHED, database_1.JobStatus.RUNNING],
    [database_1.JobStatus.DISPATCHED]: [database_1.JobStatus.RUNNING],
    [database_1.JobStatus.RUNNING]: [database_1.JobStatus.SUCCEEDED, database_1.JobStatus.FAILED, database_1.JobStatus.RETRYING],
    [database_1.JobStatus.SUCCEEDED]: [],
    [database_1.JobStatus.FAILED]: [],
    [database_1.JobStatus.RETRYING]: [database_1.JobStatus.PENDING],
};
function assertTransition(from, to, ctx) {
    const allowed = exports.ALLOWED_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
        const errorMessage = `Invalid job status transition: ${from} -> ${to}. Job ID: ${ctx.jobId}`;
        const errorCode = ctx.errorCode || 'INVALID_STATUS_TRANSITION';
        logger.error(`JOB_STATUS_TRANSITION_REJECTED: ${JSON.stringify({
            jobId: ctx.jobId,
            jobType: ctx.jobType || null,
            workerId: ctx.workerId || null,
            from,
            to,
            allowedTransitions: allowed,
            errorCode,
        })}`);
        throw new common_1.BadRequestException({
            code: 'JOB_STATE_VIOLATION',
            message: errorMessage,
            details: {
                jobId: ctx.jobId,
                from,
                to,
                allowedTransitions: allowed,
            },
        });
    }
}
function isTerminalStatus(status) {
    return status === database_1.JobStatus.SUCCEEDED || status === database_1.JobStatus.FAILED;
}
function isClaimableStatus(status) {
    return status === database_1.JobStatus.PENDING;
}
function transitionJobStatus(from, to, ctx) {
    assertTransition(from, to, {
        ...ctx,
        errorCode: 'JOB_STATE_VIOLATION',
    });
}
function transitionJobStatusAdmin(from, to, ctx) {
    if (to !== database_1.JobStatus.FAILED && to !== database_1.JobStatus.PENDING) {
        throw new common_1.BadRequestException({
            code: 'JOB_STATE_VIOLATION',
            message: `Administrative transition only allows transition to FAILED, not ${to}`,
            details: {
                jobId: ctx.jobId,
                from,
                to,
            },
        });
    }
    if (from === database_1.JobStatus.SUCCEEDED || from === database_1.JobStatus.FAILED) {
        throw new common_1.BadRequestException({
            code: 'JOB_STATE_VIOLATION',
            message: `Cannot administratively transition from terminal status: ${from}`,
            details: {
                jobId: ctx.jobId,
                from,
                to,
            },
        });
    }
    logger.log(`JOB_ADMINISTRATIVE_TRANSITION: ${JSON.stringify({
        jobId: ctx.jobId,
        jobType: ctx.jobType || null,
        workerId: ctx.workerId || null,
        from,
        to,
    })}`);
}
//# sourceMappingURL=job.rules.js.map