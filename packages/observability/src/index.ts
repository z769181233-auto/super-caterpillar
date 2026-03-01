import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import client from 'prom-client';

type TraceContext = { traceId: string };

const als = new AsyncLocalStorage<TraceContext>();

export function newTraceId() {
  return crypto.randomUUID();
}

export function runWithTrace<T>(traceId: string, fn: () => T) {
  return als.run({ traceId }, fn);
}

export function getTraceId() {
  return als.getStore()?.traceId;
}

/** Metrics registry (per-process) */
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const workerJobsActive = new client.Gauge({
  name: 'scu_worker_jobs_active',
  help: 'Active jobs in worker',
  labelNames: ['engine'] as const,
  registers: [registry],
});

export const workerJobDuration = new client.Histogram({
  name: 'scu_worker_job_duration_seconds',
  help: 'Worker job duration seconds',
  labelNames: ['engine', 'status'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 60],
  registers: [registry],
});

export const engineExecDuration = new client.Histogram({
  name: 'scu_engine_exec_duration_seconds',
  help: 'Engine execution duration seconds',
  labelNames: ['engine', 'mode'] as const,
  buckets: [0.1, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 8, 10, 20, 60],
  registers: [registry],
});

export const engineLatency = new client.Histogram({
  name: 'scu_engine_latency_seconds',
  help: 'Engine processing latency (including overhead)',
  labelNames: ['engine'] as const,
  buckets: [0.1, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 8, 10, 20, 60],
  registers: [registry],
});

export const workerJobQueueDuration = new client.Histogram({
  name: 'scu_worker_job_queue_duration_seconds',
  help: 'Time spent in queue before processing',
  labelNames: ['engine'] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300], // Queue time can be long
  registers: [registry],
});

// P1-5: Granular Breakdown Metrics
export const jobQueueDuration = new client.Histogram({
  name: 'scu_job_queue_seconds',
  help: 'Phase 1: Job Created -> Worker Claimed',
  labelNames: ['engineKey', 'jobType', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [registry],
});

export const jobPrepareDuration = new client.Histogram({
  name: 'scu_job_prepare_seconds',
  help: 'Phase 2: Claimed -> Engine Start (Deserialize/Download)',
  labelNames: ['engineKey', 'jobType', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [registry],
});

// Reuse engineExecDuration name but with consistent labels for P1-5 if needed,
// OR keep scu_engine_exec_seconds as strict core exec time.
// Current `engineExecDuration` (lines 40-46) is 'scu_engine_exec_duration_seconds' with 'engine', 'mode'.
// P1-5 requires 'scu_engine_exec_seconds' with 'engineKey', 'jobType', 'status'.
// To avoid conflict/confusion, we add the new one.
export const engineCoreExecDuration = new client.Histogram({
  name: 'scu_engine_exec_seconds', // P1-5 Spec Name
  help: 'Phase 3: Engine Start -> Engine End (Core Execution)',
  labelNames: ['engineKey', 'jobType', 'status'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 8, 10, 15, 20, 30, 60],
  registers: [registry],
});

export const jobPersistDuration = new client.Histogram({
  name: 'scu_job_persist_seconds',
  help: 'Phase 4: Engine End -> Job Result Persisted',
  labelNames: ['engineKey', 'jobType', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2],
  registers: [registry],
});

export const jobE2EDuration = new client.Histogram({
  name: 'scu_job_e2e_seconds',
  help: 'Total: Created -> API Response (End of lifecycle)',
  labelNames: ['engineKey', 'jobType', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300],
  registers: [registry],
});

export const costLedgerRecordsTotal = new client.Counter({
  name: 'scu_cost_ledger_records_total',
  help: 'Cost ledger records total',
  labelNames: ['status'] as const,
  registers: [registry],
});

export async function metricsText() {
  return registry.metrics();
}
