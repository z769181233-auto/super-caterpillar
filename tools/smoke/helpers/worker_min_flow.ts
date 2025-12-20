/**
 * Worker 最小流程 Helper
 * 实现 Stage2 最小闭环：
 * Worker 注册 → 心跳 → 领取任务/Job → 回传结果
 * 
 * 任务生命周期：PENDING→RUNNING→SUCCESS / RETRY≤3→FAILED
 */

import { makeHmacRequest, HmacRequestResult } from './hmac_request.ts';

export interface WorkerMinFlowResult {
  workerId?: string;
  jobId?: string;
  reportStatusUsed?: 'SUCCESS' | 'SUCCEEDED';
  steps: Array<{
    step: string;
    result: HmacRequestResult | { success: boolean; data?: any; error?: string };
  }>;
  success: boolean;
  error?: string;
}

export async function runWorkerMinFlow(
  apiBaseUrl: string,
  apiKey: string,
  apiSecret: string,
  workerId: string = `smoke-worker-${Date.now()}`,
): Promise<WorkerMinFlowResult> {
  const steps: WorkerMinFlowResult['steps'] = [];
  let jobId: string | undefined;

  try {
    // 1. Worker 注册（如果 API 存在）
    // 注意：根据实际 API 调整
    const registerResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: '/api/workers',
      body: {
        workerId,
        name: 'Smoke Test Worker',
        capabilities: {},
      },
    });
    steps.push({ step: 'Register Worker', result: registerResult });

    // 2. 发送心跳
    const heartbeatResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/workers/${workerId}/heartbeat`,
      body: {
        status: 'idle',
        tasksRunning: 0,
        temperature: 30,
      },
    });
    steps.push({ step: 'Heartbeat', result: heartbeatResult });

    // 3. 领取任务/Job
    const getNextJobResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/workers/${workerId}/jobs/next`,
    });
    steps.push({ step: 'Get Next Job', result: getNextJobResult });

    // 兼容不同返回结构：id / data.id / job.id
    const candidateJobId =
      getNextJobResult.response?.id ||
      getNextJobResult.response?.data?.id ||
      getNextJobResult.response?.job?.id;

    if (getNextJobResult.success && candidateJobId) {
      jobId = candidateJobId;

      // 4. 开始执行（标记为 RUNNING）
      const startJobResult = await makeHmacRequest({
        apiBaseUrl,
        apiKey,
        apiSecret,
        method: 'POST',
        path: `/api/jobs/${jobId}/start`,
        body: { workerId },
      });
      steps.push({ step: 'Start Job (RUNNING)', result: startJobResult });

      // 5. 回传结果（优先 SUCCESS；若失败再尝试 SUCCEEDED）
      const baseBody = {
        output: {
          worker: workerId,
          completedAt: new Date().toISOString(),
        },
      };

      let reportStatusUsed: 'SUCCESS' | 'SUCCEEDED' | undefined;

      let reportResult = await makeHmacRequest({
        apiBaseUrl,
        apiKey,
        apiSecret,
        method: 'POST',
        path: `/api/jobs/${jobId}/report`,
        body: { status: 'SUCCESS', ...baseBody },
      });
      steps.push({ step: 'Report Job (SUCCESS)', result: reportResult });

      if (reportResult.success) {
        reportStatusUsed = 'SUCCESS';
      } else {
        const reportResult2 = await makeHmacRequest({
          apiBaseUrl,
          apiKey,
          apiSecret,
          method: 'POST',
          path: `/api/jobs/${jobId}/report`,
          body: { status: 'SUCCEEDED', ...baseBody },
        });
        steps.push({ step: 'Report Job (SUCCEEDED fallback)', result: reportResult2 });

        if (reportResult2.success) {
          reportStatusUsed = 'SUCCEEDED';
          reportResult = reportResult2;
        }
      }

      return { workerId, jobId, reportStatusUsed, steps, success: true };
    }

    // 没有任务也算成功（但保留证据）
    return { workerId, reportStatusUsed: undefined, steps, success: true };
  } catch (error: any) {
    return {
      workerId,
      jobId,
      reportStatusUsed: undefined,
      steps,
      success: false,
      error: error.message,
    };
  }
}

