import { env } from '@scu/config';
import { engineLimiter } from '../concurrency/engine-limiter';
import { RetryPolicy } from '../retry/retry-policy';
import { ApiClient } from '../api-client';
import {
  runWithTrace,
  workerJobDuration,
  engineExecDuration, // Legacy
  workerJobsActive,
  workerJobQueueDuration, // Legacy
  engineLatency, // P1-4
  // P1-5 New Metrics
  jobQueueDuration,
  jobPrepareDuration,
  engineCoreExecDuration,
  jobPersistDuration,
  jobE2EDuration,
} from '@scu/observability';

export interface ExecutionResult {
  success: boolean;
  output?: any;
  error?: any;
  durationMs: number;
}

/**
 * JobExecutor
 * 负责任务的执行生命周期管理。
 */
export class JobExecutor {
  constructor(private readonly apiClient: ApiClient) {}

  /**
   * P1-5: Structured Span Logging Helper
   */
  private logSpan(phase: 'queue' | 'prepare' | 'exec' | 'persist' | 'e2e', data: any) {
    if (env.isDevelopment || process.env.GATE_MODE === '1') {
      console.log(
        JSON.stringify({
          span: `job.${phase === 'exec' ? 'engine.exec' : phase}`,
          ...data,
        })
      );
    }
  }

  /**
   * 执行任务（带限流、超时与重试）
   */
  async execute(
    jobId: string,
    engineKey: string,
    createdAt: string | Date,
    processor: () => Promise<any>
  ): Promise<ExecutionResult> {
    const traceId = `worker-exec-${jobId}`;
    const jobType = 'unknown'; // TODO: Pass jobType in P1-5-H1
    const labels = { engineKey, jobType, status: 'unknown' };

    workerJobsActive.inc({ engine: engineKey });

    // --- Phase 1: Queue (Created -> Claimed) ---
    const now = Date.now();
    const createdTime = new Date(createdAt).getTime();
    if (!isNaN(createdTime) && createdTime > 0) {
      const queueSeconds = Math.max(0, (now - createdTime) / 1000);
      workerJobQueueDuration.observe({ engine: engineKey }, queueSeconds); // P1-4 Legacy
      jobQueueDuration.observe({ ...labels, status: 'success' }, queueSeconds); // P1-5
      this.logSpan('queue', { traceId, jobId, duration: queueSeconds, engineKey });
    }

    return runWithTrace(traceId, async () => {
      const execStartTime = Date.now();
      let lastError: any = null;
      let output: any = null;
      let success = false;

      // 1. 获取本地令牌 (视为 Prepare 的一部分)
      const config = env as any;
      if (config.concurrencyLimiterEnabled) {
        if (!engineLimiter.acquire(engineKey)) {
          workerJobsActive.dec({ engine: engineKey });
          return {
            success: false,
            error: { message: 'Worker busy: local concurrency limit reached', code: 'WORKER_BUSY' },
            durationMs: 0,
          };
        }
      }

      // --- Phase 2: Prepare (Claimed -> Engine Start) ---
      // 实际上 Prepare 还包括下载资源等，这里简化为 "Start -> Engine Logic Invoked" 之间的间隙?
      // 或者我们将 Processor 内部再细分。
      // 为简化 P1-5 实现，我们定义 Prepare 为 "Executor Start -> Core Logic Start"
      // 由于 processor() 是一体调用的，我们假设 processor() 开始前的 overhead 是 Prepare。
      // 当前代码结构下，Prepare 时间极短 (Acquire Token)，除非把 Download 移出 Processor。
      // 暂且记录 Token Acquire 时间为 Prepare。
      const prepareEnd = Date.now();
      const prepareSeconds = (prepareEnd - execStartTime) / 1000;
      jobPrepareDuration.observe({ ...labels, status: 'success' }, prepareSeconds);
      this.logSpan('prepare', { traceId, jobId, duration: prepareSeconds, engineKey });

      try {
        let attempt = 1;

        while (attempt <= (config.retryPolicyEnabled ? config.retryMaxAttempts : 1)) {
          try {
            // --- Phase 3: Engine Exec (Core Execution) ---
            const engineStart = Date.now();

            // 2. 执行逻辑（带超时）
            output = await this.executeWithTimeout(engineKey, processor);

            const engineEnd = Date.now();
            const engineDuration = (engineEnd - engineStart) / 1000;

            engineCoreExecDuration.observe({ ...labels, status: 'success' }, engineDuration);
            this.logSpan('exec', { traceId, jobId, duration: engineDuration, engineKey });

            // Legacy Metrics
            workerJobDuration.observe({ engine: engineKey, status: 'success' }, engineDuration);
            engineLatency.observe({ engine: engineKey }, engineDuration);

            success = true;
            break; // Success
          } catch (error: any) {
            lastError = error;

            // 3. 检查是否重试
            if (RetryPolicy.shouldRetry(attempt)) {
              const delay = RetryPolicy.getDelay(attempt);
              console.warn(
                `[Executor] Job ${jobId} failed (attempt ${attempt}). Retrying in ${delay}ms... Error: ${error.message}`
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
              attempt++;
            } else {
              break;
            }
          }
        }
      } finally {
        // finally block handles Persist simulation & Cleanup
        const engineEnd = Date.now();

        // --- Phase 4: Persist (Engine End -> cleanup/return) ---
        // 实际的 Persist (API call) 发生在 executor 返回之后 (WorkerApp 中)。
        // 这里的 finally 只是收尾。为了 P1-5 闭环，我们在 WorkerApp 层面补 Persist span 更合适。
        // 但这里我们先记录 "Executor Post-Processing" 作为 Persist 的一部分。
        const persistSeconds = (Date.now() - engineEnd) / 1000;
        jobPersistDuration.observe(
          { ...labels, status: success ? 'success' : 'failed' },
          persistSeconds
        );
        this.logSpan('persist', { traceId, jobId, duration: persistSeconds, engineKey });

        workerJobsActive.dec({ engine: engineKey });
        // 4. 释放令牌
        if (config.concurrencyLimiterEnabled) {
          engineLimiter.release(engineKey);
        }
      }

      // --- Phase 5: E2E (Total) ---
      const totalDuration = (Date.now() - execStartTime) / 1000; // Worker Side Exec Duration
      const e2eSeconds =
        !isNaN(createdTime) && createdTime > 0 ? (Date.now() - createdTime) / 1000 : 0;

      if (e2eSeconds > 0) {
        jobE2EDuration.observe({ ...labels, status: success ? 'success' : 'failed' }, e2eSeconds);
        this.logSpan('e2e', {
          traceId,
          jobId,
          duration: e2eSeconds,
          totalWorkerDuration: totalDuration,
          engineKey,
        });
      }

      if (!success) {
        workerJobDuration.observe(
          { engine: engineKey, status: 'failed' },
          (Date.now() - execStartTime) / 1000
        );
        return {
          success: false,
          error: lastError || { message: 'Execution failed after retries' },
          durationMs: Date.now() - execStartTime,
        };
      }

      return {
        success: true,
        output,
        durationMs: Date.now() - execStartTime,
      };
    });
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout(engineKey: string, processor: () => Promise<any>): Promise<any> {
    const config = env as any;
    if (!config.execTimeoutEnabled) {
      return processor();
    }

    const timeoutSeconds = config.getEngineTimeoutSeconds(engineKey);
    const timeoutMs = timeoutSeconds * 1000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeoutSeconds}s for engine ${engineKey}`));
      }, timeoutMs);

      processor()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
