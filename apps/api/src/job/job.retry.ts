/**
 * Job 重试规则与计算
 * 
 * 统一重试上限判断、nextRetryAt/backoff 计算、统一入口。
 * 参考《平台任务系统与异步执行机制说明书_TaskSystemAsyncExecutionSpec_V1.0》
 */

import { Prisma, JobStatus } from 'database';

/**
 * 重试计算结果
 */
export interface RetryComputation {
  nextRetryCount: number;
  nextRetryAt: Date | null;
  shouldFail: boolean;
  backoffMs: number;
}

/**
 * 计算下次重试信息
 * 
 * 规则：
 * - nextRetryCount = retryCount + 1
 * - 若 nextRetryCount >= maxRetry → shouldFail = true（直接 FAILED）
 * - 否则使用指数退避：backoffMs = baseDelay * 2^(nextRetryCount - 1)
 * 
 * @param job Job 对象（必须包含 retryCount 和 maxRetry）
 * @returns 重试计算结果
 */
export function computeNextRetry(job: {
  retryCount: number;
  maxRetry: number;
}): RetryComputation {
  const nextRetryCount = job.retryCount + 1;
  const shouldFail = nextRetryCount >= job.maxRetry;

  // 指数退避：baseDelay * 2^(nextRetryCount - 1)
  // nextRetryCount=1: 1s, nextRetryCount=2: 2s, nextRetryCount=3: 4s, ...
  const baseDelayMs = 1000; // 1 秒
  const backoffMs = shouldFail ? 0 : baseDelayMs * Math.pow(2, nextRetryCount - 1);
  const nextRetryAt = shouldFail ? null : new Date(Date.now() + backoffMs);

  return {
    nextRetryCount,
    nextRetryAt,
    shouldFail,
    backoffMs,
  };
}

/**
 * 统一把 RUNNING job 写入 RETRYING 或 FAILED
 * 
 * 规则：
 * - 只用 retryCount/maxRetry 判断，不使用 attempts
 * - 如果 shouldFail = true → status = FAILED
 * - 如果 shouldFail = false → status = RETRYING，并在 payload 中存储 nextRetryAt
 * 
 * @param tx 事务客户端
 * @param job Job 对象
 * @param failPayload 失败时的额外信息（errorMessage 等）
 * @returns 更新后的 Job
 */
export async function markRetryOrFail(
  tx: Prisma.TransactionClient,
  job: {
    id: string;
    retryCount: number;
    maxRetry: number;
    payload: any;
  },
  failPayload: {
    errorMessage?: string;
  } = {},
): Promise<{ status: JobStatus; retryCount: number; nextRetryAt: Date | null }> {
  const computation = computeNextRetry(job);

  // 更新 payload（存储 nextRetryAt 和 backoffDelayMs）
  const payload = (job.payload as Record<string, any>) || {};
  if (computation.shouldFail) {
    // 最终失败，清除重试信息
    delete payload.nextRetryAt;
    delete payload.backoffDelayMs;
  } else {
    // 进入重试，存储下次重试时间
    payload.nextRetryAt = computation.nextRetryAt?.toISOString();
    payload.backoffDelayMs = computation.backoffMs;
  }

  // 更新 Job 状态
  const status = computation.shouldFail ? JobStatus.FAILED : JobStatus.RETRYING;

  await tx.shotJob.update({
    where: { id: job.id },
    data: {
      status,
      payload: payload as any,
      lastError: failPayload.errorMessage || 'Processing failed',
      retryCount: computation.nextRetryCount,
      workerId: null, // 清除 Worker 分配，允许重新分配
      leaseUntil: null, // P1-1: 释放租约，允许重试领取
      lockedBy: null, // P1-1: 清除锁定标记
    },
  });

  return {
    status,
    retryCount: computation.nextRetryCount,
    nextRetryAt: computation.nextRetryAt,
  };
}

