import { ProjectOverviewDTO } from '@scu/shared-types';

export const getProjectOverviewMock = (projectId: string): ProjectOverviewDTO => {
  return {
    header: {
      id: projectId,
      idShort: projectId.split('-')[0],
      name: 'Test Project Gamma',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'RUNNING',
      stage: {
        currentKey: 'STRUCTURE_ANALYSIS',
        currentLabel: '结构分析',
        progressPct: 65,
      },
      blocking: {
        isBlocked: false,
      },
      risk: {
        quality: 'WARN',
        cost: 'OK',
        compliance: 'OK',
      },
    },
    flow: {
      nodes: [
        {
          key: 'NOVEL_IMPORT',
          label: '小说导入',
          status: 'DONE',
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          endedAt: new Date(Date.now() - 3500000).toISOString(),
          gate: { canRun: false }, // Done
          actions: [{ key: 'VIEW_REPORT', label: '查看文件', enabled: true }],
        },
        {
          key: 'STRUCTURE_ANALYSIS',
          label: '结构分析',
          status: 'RUNNING',
          startedAt: new Date(Date.now() - 60000).toISOString(),
          gate: { canRun: true },
          actions: [
            { key: 'VIEW_REPORT', label: '查看日志', enabled: true },
            { key: 'RETRY', label: '重新分析', enabled: true },
          ],
        },
        {
          key: 'SCRIPT_SEMANTIC',
          label: '剧本语义',
          status: 'PENDING',
          gate: {
            canRun: false,
            blockedReason: 'PREVIOUS_STAGE_NOT_READY',
          },
          actions: [{ key: 'RUN', label: '开始生成', enabled: false }],
        },
        {
          key: 'SHOT_PLANNING',
          label: '分镜规划',
          status: 'PENDING',
          gate: { canRun: false },
          actions: [],
        },
        {
          key: 'ASSET_GENERATION',
          label: '资产生成',
          status: 'PENDING',
          gate: { canRun: false },
          actions: [],
        },
        {
          key: 'VIDEO_GENERATION',
          label: '视频生成',
          status: 'PENDING',
          gate: { canRun: false },
          actions: [],
        },
        {
          key: 'COMPOSE_EXPORT',
          label: '合成导出',
          status: 'PENDING',
          gate: { canRun: false },
          actions: [],
        },
      ],
    },
    next: {
      action: {
        key: 'WAIT',
        label: '等待分析完成',
        canRun: false,
        disabledReason: 'Worker processing...',
      },
      why: '当前结构分析任务正在进行中 (65%)',
      estimate: { etaSec: 45 },
    },
    stats: {
      seasons: 2,
      episodes: 8,
      scenes: 42,
      shots: 156,
      issues: {
        total: 5,
        missingBindings: 3,
        semanticConflicts: 1,
        qaFailed: 1,
      },
      links: {
        structureView: `/projects/${projectId}?tab=structure`,
        issuesView: `/projects/${projectId}?tab=quality`,
      },
    },
    jobs: {
      running: [
        {
          id: 'job-123',
          type: 'NOVEL_ANALYSIS',
          status: 'RUNNING',
          progressPct: 65,
          startedAt: new Date(Date.now() - 60000).toISOString(),
          workerId: 'worker-01',
        },
      ],
      queuedCount: 2,
      failed: [],
    },
    quality: {
      structure: 'WARN',
      semantic: 'OK',
      visual: 'OK',
    },
    cost: {
      total: { money: 12.5, tokens: 450000 },
      last24h: { money: 2.5 },
      currentRunEstimate: { money: 0.8 },
      alert: { level: 'OK' },
    },
    audit: {
      recent: [
        {
          at: new Date(Date.now() - 3600000).toISOString(),
          actor: { id: 'u1', name: 'Adam' },
          action: 'IMPORT_NOVEL',
          result: 'OK',
        },
        {
          at: new Date(Date.now() - 60000).toISOString(),
          actor: { id: 'u1', name: 'Adam' },
          action: 'START_ANALYSIS',
          result: 'OK',
        },
      ],
      href: `/projects/audit`,
    },
  };
};
