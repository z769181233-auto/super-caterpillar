"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.costLedgerRecordsTotal = exports.jobE2EDuration = exports.jobPersistDuration = exports.engineCoreExecDuration = exports.jobPrepareDuration = exports.jobQueueDuration = exports.workerJobQueueDuration = exports.engineLatency = exports.engineExecDuration = exports.workerJobDuration = exports.workerJobsActive = exports.registry = void 0;
exports.newTraceId = newTraceId;
exports.runWithTrace = runWithTrace;
exports.getTraceId = getTraceId;
exports.metricsText = metricsText;
const node_async_hooks_1 = require("node:async_hooks");
const node_crypto_1 = __importDefault(require("node:crypto"));
const prom_client_1 = __importDefault(require("prom-client"));
const als = new node_async_hooks_1.AsyncLocalStorage();
function newTraceId() {
    return node_crypto_1.default.randomUUID();
}
function runWithTrace(traceId, fn) {
    return als.run({ traceId }, fn);
}
function getTraceId() {
    return als.getStore()?.traceId;
}
exports.registry = new prom_client_1.default.Registry();
prom_client_1.default.collectDefaultMetrics({ register: exports.registry });
exports.workerJobsActive = new prom_client_1.default.Gauge({
    name: 'scu_worker_jobs_active',
    help: 'Active jobs in worker',
    labelNames: ['engine'],
    registers: [exports.registry],
});
exports.workerJobDuration = new prom_client_1.default.Histogram({
    name: 'scu_worker_job_duration_seconds',
    help: 'Worker job duration seconds',
    labelNames: ['engine', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 60],
    registers: [exports.registry],
});
exports.engineExecDuration = new prom_client_1.default.Histogram({
    name: 'scu_engine_exec_duration_seconds',
    help: 'Engine execution duration seconds',
    labelNames: ['engine', 'mode'],
    buckets: [0.1, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 8, 10, 20, 60],
    registers: [exports.registry],
});
exports.engineLatency = new prom_client_1.default.Histogram({
    name: 'scu_engine_latency_seconds',
    help: 'Engine processing latency (including overhead)',
    labelNames: ['engine'],
    buckets: [0.1, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 8, 10, 20, 60],
    registers: [exports.registry],
});
exports.workerJobQueueDuration = new prom_client_1.default.Histogram({
    name: 'scu_worker_job_queue_duration_seconds',
    help: 'Time spent in queue before processing',
    labelNames: ['engine'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
    registers: [exports.registry],
});
exports.jobQueueDuration = new prom_client_1.default.Histogram({
    name: 'scu_job_queue_seconds',
    help: 'Phase 1: Job Created -> Worker Claimed',
    labelNames: ['engineKey', 'jobType', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
    registers: [exports.registry],
});
exports.jobPrepareDuration = new prom_client_1.default.Histogram({
    name: 'scu_job_prepare_seconds',
    help: 'Phase 2: Claimed -> Engine Start (Deserialize/Download)',
    labelNames: ['engineKey', 'jobType', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
    registers: [exports.registry],
});
exports.engineCoreExecDuration = new prom_client_1.default.Histogram({
    name: 'scu_engine_exec_seconds',
    help: 'Phase 3: Engine Start -> Engine End (Core Execution)',
    labelNames: ['engineKey', 'jobType', 'status'],
    buckets: [0.1, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 8, 10, 15, 20, 30, 60],
    registers: [exports.registry],
});
exports.jobPersistDuration = new prom_client_1.default.Histogram({
    name: 'scu_job_persist_seconds',
    help: 'Phase 4: Engine End -> Job Result Persisted',
    labelNames: ['engineKey', 'jobType', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2],
    registers: [exports.registry],
});
exports.jobE2EDuration = new prom_client_1.default.Histogram({
    name: 'scu_job_e2e_seconds',
    help: 'Total: Created -> API Response (End of lifecycle)',
    labelNames: ['engineKey', 'jobType', 'status'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300],
    registers: [exports.registry],
});
exports.costLedgerRecordsTotal = new prom_client_1.default.Counter({
    name: 'scu_cost_ledger_records_total',
    help: 'Cost ledger records total',
    labelNames: ['status'],
    registers: [exports.registry],
});
async function metricsText() {
    return exports.registry.metrics();
}
//# sourceMappingURL=index.js.map