/**
 * Stage3-A: Engine Binding + Worker Claim 闭环验证
 * 验证：创建 Job -> engineBinding=BOUND -> worker(capabilities.supportedEngines) 能领取到
 */

import { makeHmacRequest, HmacRequestResult } from './hmac_request.ts';

export interface EngineBindingFlowResult {
  jobId?: string;
  engineBindingId?: string;
  engineId?: string;
  engineKey?: string;
  bindingStatus?: string;
  workerId?: string;
  supportedEngines?: string[];
  claimable?: boolean;
  steps: Array<{
    step: string;
    result: HmacRequestResult | { success: boolean; data?: any; error?: string };
  }>;
  success: boolean;
  error?: string;
}

/**
 * 验证 Engine Binding + Worker Claim 闭环
 * Stage3-A: 使用 NOVEL_ANALYSIS，payload 只需要 { projectId }
 */
export async function runEngineBindingFlow(
  apiBaseUrl: string,
  apiKey: string,
  apiSecret: string,
  organizationId: string,
  projectId: string,
  workerId: string
): Promise<EngineBindingFlowResult> {
  const steps: EngineBindingFlowResult['steps'] = [];
  let jobId: string | undefined;
  let engineBindingId: string | undefined;
  let engineId: string | undefined;
  let engineKey: string | undefined;
  let bindingStatus: string | undefined;

  try {
    // 0. 导入小说源（分析的前置条件）
    const importNovelResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/projects/${projectId}/novel/import`,
      body: {
        title: 'Smoke Test Novel',
        content:
          'This is a demo novel text for smoke testing purpose. It contains enough content to be parsed into chapters if the parser allows.\n\n第1章 开端\n这是第一章的内容。',
      },
    });
    steps.push({
      step: 'Import Novel Source (Pre-condition for Analyze)',
      result: importNovelResult,
    });
    if (
      !importNovelResult.success ||
      (importNovelResult.status !== 201 && importNovelResult.status !== 200)
    ) {
      console.error(
        '[EngineBindingFlow] Novel import failed:',
        JSON.stringify(importNovelResult.response)
      );
      throw new Error(
        `Failed to import novel: status=${importNovelResult.status}, body=${JSON.stringify(importNovelResult.response)}`
      );
    }

    // 1. 创建 NOVEL_ANALYSIS Job
    // 使用项目里已存在的"触发小说分析"的 endpoint: /api/projects/:projectId/novel/analyze
    // 注意：analyze 端点需要先有 NovelSource，现在我们已经导入了
    const createJobResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/projects/${projectId}/novel/analyze`,
      body: {}, // 传入空对象以对齐签名逻辑
    });
    steps.push({
      step: 'Create NOVEL_ANALYSIS Job (via /api/projects/:projectId/novel/analyze)',
      result: createJobResult,
    });

    if (
      !createJobResult.success ||
      (createJobResult.status !== 201 && createJobResult.status !== 200)
    ) {
      throw new Error(`Failed to create job: ${JSON.stringify(createJobResult.response)}`);
    }

    // analyze 端点返回 task，需要从 task 中获取 jobId
    // 根据 novel-import.controller.ts，analyze 端点会创建 job 并返回 task
    const taskId =
      createJobResult.response?.data?.task?.id ||
      createJobResult.response?.data?.taskId ||
      createJobResult.response?.task?.id ||
      createJobResult.response?.taskId;

    if (!taskId) {
      throw new Error(
        `Failed to extract taskId from response: ${JSON.stringify(createJobResult.response)}`
      );
    }

    // 通过 taskId 查询 job（NOVEL_ANALYSIS 类型）
    const getTaskJobsResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'GET',
      path: `/api/tasks/${taskId}`,
    });
    steps.push({ step: 'Get Task with Jobs', result: getTaskJobsResult });

    if (getTaskJobsResult.success && getTaskJobsResult.status === 200) {
      const task = getTaskJobsResult.response?.data || getTaskJobsResult.response;
      const jobs = task?.jobs || [];
      if (Array.isArray(jobs) && jobs.length > 0) {
        // 找到 NOVEL_ANALYSIS 类型的 job
        const novelJob = jobs.find((j: any) => j.type === 'NOVEL_ANALYSIS');
        if (novelJob) {
          jobId = novelJob.id;
        } else if (jobs[0]) {
          jobId = jobs[0].id;
        }
      }
    }

    if (!jobId) {
      throw new Error(
        `Failed to extract jobId from task ${taskId}. Response: ${JSON.stringify(getTaskJobsResult.response)}`
      );
    }

    // 2. 查询 job 的 engineBinding 存在且 status=BOUND
    const getJobResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'GET',
      path: `/api/jobs/${jobId}`,
    });
    steps.push({ step: 'Get Job with Binding', result: getJobResult });

    if (!getJobResult.success || getJobResult.status !== 200) {
      throw new Error(`Failed to get job: ${JSON.stringify(getJobResult.response)}`);
    }

    // 从响应中提取 engineBinding（可能在 data.engineBinding 或 data.data.engineBinding）
    const jobData = getJobResult.response?.data || getJobResult.response;
    const engineBinding = jobData?.engineBinding;
    if (!engineBinding) {
      throw new Error('Job has no engine binding');
    }

    engineBindingId = engineBinding.id;
    engineId = engineBinding.engineId; // ✅ 从 engineBinding 读取 engineId
    engineKey = engineBinding.engineKey;
    bindingStatus = engineBinding.status;

    if (bindingStatus !== 'BOUND') {
      throw new Error(`Engine binding status is not BOUND: ${bindingStatus}`);
    }

    // 3. 注册 worker，使用刚拿到的 engineId 作为 supportedEngines
    const registerWorkerResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/workers/${workerId}/register`,
      body: {
        name: 'Smoke Test Worker',
        capabilities: {
          supportedEngines: [engineId], // ✅ 用 engineId，不是 engineKey
        },
      },
    });
    steps.push({ step: 'Register Worker with supportedEngines', result: registerWorkerResult });

    // 4. Worker 领取 Job（jobType 改成 NOVEL_ANALYSIS，保证同类型领取）
    const claimJobResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/workers/${workerId}/jobs/next`,
      body: {
        jobType: 'NOVEL_ANALYSIS', // ✅ 保证同类型领取
      },
    });
    steps.push({ step: 'Claim Job', result: claimJobResult });

    const claimable = claimJobResult.success && claimJobResult.status === 200;

    return {
      jobId,
      engineBindingId,
      engineId,
      engineKey,
      bindingStatus,
      workerId,
      supportedEngines: [engineId], // 返回实际使用的 supportedEngines
      claimable,
      steps,
      success: true,
    };
  } catch (error: any) {
    return {
      jobId,
      engineBindingId,
      engineId,
      engineKey,
      bindingStatus,
      workerId,
      supportedEngines: engineId ? [engineId] : undefined,
      steps,
      success: false,
      error: error.message,
    };
  }
}
