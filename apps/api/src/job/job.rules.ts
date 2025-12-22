/**
 * Job 状态机规则
 * 
 * 定义所有允许的状态转换，禁止任何未定义的转换。
 * 参考《平台任务系统与异步执行机制说明书_TaskSystemAsyncExecutionSpec_V1.0》
 */

import { BadRequestException } from '@nestjs/common';
import { JobStatus } from 'database';

/**
 * 允许的状态转换表
 * 
 * 规则（Stage2-A）：
 * - PENDING -> DISPATCHED: Orchestrator 领取任务（事务内标记）
 * - DISPATCHED -> RUNNING: Worker 开始执行
 * - RUNNING -> SUCCEEDED: Job 执行成功
 * - RUNNING -> FAILED: Job 执行失败且达到最大重试次数
 * - RUNNING -> RETRYING: Job 执行失败但未达到最大重试次数
 * - RETRYING -> PENDING: Orchestrator 释放到期重试 Job（只能由 orchestrator 释放，worker 不得直接领取 RETRYING）
 * 
 * 任何其它转换一律 reject + audit + error_code=JOB_STATE_VIOLATION
 */
export const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]: [JobStatus.DISPATCHED, JobStatus.RUNNING],
  [JobStatus.DISPATCHED]: [JobStatus.RUNNING],
  [JobStatus.RUNNING]: [JobStatus.SUCCEEDED, JobStatus.FAILED, JobStatus.RETRYING],
  [JobStatus.SUCCEEDED]: [], // 终态，不允许转换
  [JobStatus.FAILED]: [], // 终态，不允许转换
  [JobStatus.RETRYING]: [JobStatus.PENDING], // 只能由 orchestrator 释放
};

/**
 * 断言状态转换是否允许
 * 
 * @param from 源状态
 * @param to 目标状态
 * @param ctx 上下文信息（用于错误日志和审计）
 * @throws {Error} 如果转换不允许
 */
export function assertTransition(
  from: JobStatus,
  to: JobStatus,
  ctx: {
    jobId: string;
    jobType?: string;
    workerId?: string;
    errorCode?: string;
  },
): void {
  const allowed = ALLOWED_TRANSITIONS[from] || [];

  if (!allowed.includes(to)) {
    const errorMessage = `Invalid job status transition: ${from} -> ${to}. Job ID: ${ctx.jobId}`;
    const errorCode = ctx.errorCode || 'INVALID_STATUS_TRANSITION';

    // 记录错误日志（结构化格式）
    console.error(JSON.stringify({
      event: 'JOB_STATUS_TRANSITION_REJECTED',
      jobId: ctx.jobId,
      jobType: ctx.jobType || null,
      workerId: ctx.workerId || null,
      from,
      to,
      allowedTransitions: allowed,
      errorCode,
      timestamp: new Date().toISOString(),
    }));

    // Stage2-A: 使用 BadRequestException，错误码 JOB_STATE_VIOLATION
    throw new BadRequestException({
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

/**
 * 检查状态是否为终态
 */
export function isTerminalStatus(status: JobStatus): boolean {
  return status === JobStatus.SUCCEEDED || status === JobStatus.FAILED;
}

/**
 * 检查状态是否允许被 Worker 领取
 */
export function isClaimableStatus(status: JobStatus): boolean {
  return status === JobStatus.PENDING;
}

/**
 * 统一的状态转换函数（Stage2-A）
 * 所有状态更新必须通过此函数，强制校验合法流转
 * 
 * @param jobId Job ID
 * @param from 源状态
 * @param to 目标状态
 * @param ctx 上下文信息
 * @throws {BadRequestException} 如果转换不允许，错误码 JOB_STATE_VIOLATION
 */
export function transitionJobStatus(
  from: JobStatus,
  to: JobStatus,
  ctx: {
    jobId: string;
    jobType?: string;
    workerId?: string;
  },
): void {
  assertTransition(from, to, {
    ...ctx,
    errorCode: 'JOB_STATE_VIOLATION',
  });
}

/**
 * 管理性状态转换函数（Stage2-A）
 * 用于管理员操作（如取消、强制失败），允许从任何非终态转换到 FAILED
 * 
 * @param from 源状态
 * @param to 目标状态（通常为 FAILED）
 * @param ctx 上下文信息
 * @throws {BadRequestException} 如果源状态是终态或目标状态不是 FAILED
 */
export function transitionJobStatusAdmin(
  from: JobStatus,
  to: JobStatus,
  ctx: {
    jobId: string;
    jobType?: string;
    workerId?: string;
  },
): void {
  // 管理性操作只允许转换到 FAILED
  if (to !== JobStatus.FAILED) {
    throw new BadRequestException({
      code: 'JOB_STATE_VIOLATION',
      message: `Administrative transition only allows transition to FAILED, not ${to}`,
      details: {
        jobId: ctx.jobId,
        from,
        to,
      },
    });
  }

  // 不允许从终态转换
  if (from === JobStatus.SUCCEEDED || from === JobStatus.FAILED) {
    throw new BadRequestException({
      code: 'JOB_STATE_VIOLATION',
      message: `Cannot administratively transition from terminal status: ${from}`,
      details: {
        jobId: ctx.jobId,
        from,
        to,
      },
    });
  }

  // 允许从任何非终态转换到 FAILED（管理性操作）
  // 记录日志但不抛出异常
  console.log(JSON.stringify({
    event: 'JOB_ADMINISTRATIVE_TRANSITION',
    jobId: ctx.jobId,
    jobType: ctx.jobType || null,
    workerId: ctx.workerId || null,
    from,
    to,
    timestamp: new Date().toISOString(),
  }));
}

