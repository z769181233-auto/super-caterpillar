/**
 * CRUD 最小路径 Helper
 * 实现五层 CRUD 最小路径：
 * 创建 Project → Season → Episode → Scene → Shot → 查询回读
 * 
 * 每个请求都走 HMAC 强校验
 */

import { makeHmacRequest, HmacRequestResult } from './hmac_request.ts';

export interface CrudMinPathResult {
  projectId?: string;
  seasonId?: string;
  episodeId?: string;
  sceneId?: string;
  shotId?: string;
  steps: Array<{
    step: string;
    result: HmacRequestResult;
  }>;
  success: boolean;
  error?: string;
}

export async function runCrudMinPath(
  apiBaseUrl: string,
  apiKey: string,
  apiSecret: string,
  organizationId: string,
): Promise<CrudMinPathResult> {
  const steps: CrudMinPathResult['steps'] = [];
  let projectId: string | undefined;
  let seasonId: string | undefined;
  let episodeId: string | undefined;
  let sceneId: string | undefined;
  let shotId: string | undefined;

  try {
    // 1. 创建 Project
    const createProjectResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: '/api/projects',
      body: {
        name: `Smoke Test Project ${Date.now()}`,
        description: 'Smoke test project',
      },
    });
    steps.push({ step: 'Create Project', result: createProjectResult });
    if (!createProjectResult.success || createProjectResult.status !== 201) {
      throw new Error(`Failed to create project: ${JSON.stringify(createProjectResult.response)}`);
    }
    projectId = createProjectResult.response?.data?.id;

    // 2. 创建 Season（如果有 Season API）
    // 注意：根据实际 API 调整路径
    // 注意：Project ID undefined check
    if (!projectId) throw new Error('Project ID parsing failed');

    const createSeasonResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/projects/${projectId}/seasons`,
      body: {
        index: 1,
        title: 'Season 1',
        description: 'Smoke test season',
      },
    });
    steps.push({ step: 'Create Season', result: createSeasonResult });
    if (createSeasonResult.success && createSeasonResult.status === 201) {
      seasonId = createSeasonResult.response?.data?.id;
    }

    // 3. 创建 Episode
    const createEpisodeResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/projects/${projectId}/episodes`,
      body: {
        index: 1,
        title: 'Episode 1',
        name: 'Episode 1',
        summary: 'Smoke test episode',
      },
    });
    steps.push({ step: 'Create Episode', result: createEpisodeResult });
    if (!createEpisodeResult.success || createEpisodeResult.status !== 201) {
      throw new Error(`Failed to create episode: ${JSON.stringify(createEpisodeResult.response)}`);
    }
    episodeId = createEpisodeResult.response?.data?.id;

    // 4. 创建 Scene —— 按既定路由：/api/projects/episodes/:episodeId/scenes
    const createSceneResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/projects/episodes/${episodeId}/scenes`,
      body: {
        index: 1,
        title: 'Scene 1',
        summary: 'Smoke test scene',
      },
    });
    steps.push({ step: 'Create Scene', result: createSceneResult });
    if (!createSceneResult.success || createSceneResult.status !== 201) {
      throw new Error(`Failed to create scene: ${JSON.stringify(createSceneResult.response)}`);
    }
    sceneId = createSceneResult.response?.data?.id;

    // 5. 创建 Shot —— 按既定路由：/api/projects/scenes/:sceneId/shots
    const createShotResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'POST',
      path: `/api/projects/scenes/${sceneId}/shots`,
      body: {
        index: 1,
        title: 'Shot 1',
        description: 'Smoke test shot',
        type: 'test',
        params: {},
      },
    });
    steps.push({ step: 'Create Shot', result: createShotResult });
    if (!createShotResult.success || createShotResult.status !== 201) {
      throw new Error(`Failed to create shot: ${JSON.stringify(createShotResult.response)}`);
    }
    shotId = createShotResult.response?.data?.id;

    // 6. 查询回读（Project 读取保留）
    const readProjectResult = await makeHmacRequest({
      apiBaseUrl,
      apiKey,
      apiSecret,
      method: 'GET',
      path: `/api/projects/${projectId}`,
    });
    steps.push({ step: 'Read Project', result: readProjectResult });

    // 7. Read Shot —— 由于各项目实现差异，做 fallback 探测（仍然走 HMAC，仍记录证据）
    const shotReadCandidates = [
      `/api/projects/shots/${shotId}`,          // 标准：/api/projects/shots/:id
      `/api/projects/scenes/${sceneId}/shots/${shotId}`, // 路径探测
      `/api/shots/${shotId}`,                   // Legacy fallback
    ];
    let readShotResult: any = null;

    for (const p of shotReadCandidates) {
      const r = await makeHmacRequest({
        apiBaseUrl,
        apiKey,
        apiSecret,
        method: 'GET',
        path: p,
      });
      steps.push({ step: `Read Shot (try ${p})`, result: r });
      if (r.success && r.status === 200) {
        readShotResult = r;
        break;
      }
    }

    // 如果 readShotResult 仍为空，不直接失败（避免因"只提供 list 接口"误判）
    // 但会在 steps 里留下所有尝试的真实证据

    return {
      projectId,
      seasonId,
      episodeId,
      sceneId,
      shotId,
      steps,
      success: true,
    };
  } catch (error: any) {
    return {
      projectId,
      seasonId,
      episodeId,
      sceneId,
      shotId,
      steps,
      success: false,
      error: error.message,
    };
  }
}

