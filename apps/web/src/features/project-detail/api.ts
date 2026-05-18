import {
  adaptProjectDetail,
  adaptBuildsList,
  adaptEvidenceSummary,
  ProjectDetailView,
  BuildRowView,
  EvidenceSummaryView,
} from './adapters';

type ProjectShot = {
  id: string;
  index: number;
  summary?: string;
  startOffset?: number;
  endOffset?: number;
};

type ProjectScene = {
  id: string;
  index: number;
  title?: string;
  summary?: string;
  shots?: ProjectShot[];
};

type ProjectEpisode = {
  id: string;
  index: number;
  title: string;
  summary?: string;
  scenes?: ProjectScene[];
};

type ProjectSeason = {
  episodes?: ProjectEpisode[];
};

type ProjectOverviewAuditLog = {
  id: string;
  resourceId?: string;
  at?: string;
};

type ProjectOverviewNextAction = {
  action?: {
    canRun?: boolean;
  };
};

type ProjectRunningJob = {
  id: string;
  jobType?: string;
  taskId?: string;
  status?: string;
  createdAt?: string;
};

type ProjectDetailApiData = {
  id?: string;
  name?: string;
  organizationId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  seasons?: ProjectSeason[];
  episodes?: ProjectEpisode[];
};

type ProjectOverviewApiData = {
  runningJobs?: ProjectRunningJob[];
  auditLogs?: ProjectOverviewAuditLog[];
  nextAction?: ProjectOverviewNextAction;
};

type NovelAnalysisJob = {
  id: string;
  status?: string;
  type?: string;
  jobType?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: {
    message?: string;
  };
};

function getProjectEpisodes(raw: ProjectDetailApiData) {
  const seasonEpisodes = (raw?.seasons || []).flatMap((season) => season?.episodes || []);
  return seasonEpisodes.length > 0 ? seasonEpisodes : raw?.episodes || [];
}

/**
 * 从后端 API 拿取项目主视图真实数据
 */
export async function getProjectDetail(projectId: string): Promise<ProjectDetailView> {
  const [detailResponse, overviewResponse, novelJobsResponse] = await Promise.all([
    fetch(`/api/projects/${projectId}/`, { cache: 'no-store' }),
    fetch(`/api/projects/${projectId}/overview/`, { cache: 'no-store' }),
    fetch(`/api/projects/${projectId}/novel/jobs/`, { cache: 'no-store' }),
  ]);

  const result = (await detailResponse.json()) as ApiEnvelope<ProjectDetailApiData>;

  if (!detailResponse.ok || !result.success) {
    throw new Error(result.error?.message || 'Failed to fetch project detail');
  }

  const overviewResult = overviewResponse.ok
    ? ((await overviewResponse.json()) as ApiEnvelope<ProjectOverviewApiData>)
    : null;
  const novelJobsResult = novelJobsResponse.ok
    ? ((await novelJobsResponse.json()) as ApiEnvelope<NovelAnalysisJob[]>)
    : null;

  const raw = result.data ?? {};
  const episodes = getProjectEpisodes(raw);
  const runningJobs = overviewResult?.data?.runningJobs || [];
  const novelJobsData = novelJobsResult?.data;
  const novelJobs = Array.isArray(novelJobsData)
    ? novelJobsData || []
    : novelJobsData &&
        typeof novelJobsData === 'object' &&
        Array.isArray((novelJobsData as { jobs?: NovelAnalysisJob[] }).jobs)
      ? (novelJobsData as { jobs?: NovelAnalysisJob[] }).jobs || []
      : [];
  const latestNovelJob = novelJobs[0];

  const latestRunningNovelJob = runningJobs.find((job) => String(job.jobType || '').includes('NOVEL'));
  const normalizedLatestNovelJobStatus = latestNovelJob?.status
    ? String(latestNovelJob.status).toUpperCase()
    : null;
  const normalizedRawStatus = raw.status ? String(raw.status).toUpperCase() : '';
  const hasActiveOverviewJobs = runningJobs.some((job) =>
    ['PENDING', 'RUNNING', 'RETRYING'].includes(String(job.status || '').toUpperCase())
  );
  const hasPendingNovelJob =
    normalizedLatestNovelJobStatus !== null &&
    ['PENDING', 'RUNNING', 'RETRYING'].includes(normalizedLatestNovelJobStatus);
  const hasTerminalNovelJob =
    normalizedLatestNovelJobStatus !== null &&
    ['SUCCEEDED', 'DONE', 'FAILED'].includes(normalizedLatestNovelJobStatus);
  const effectiveProjectStatus = hasActiveOverviewJobs || hasPendingNovelJob
    ? 'RUNNING'
    : hasTerminalNovelJob
      ? normalizedLatestNovelJobStatus === 'FAILED'
        ? 'ERROR'
        : 'READY'
      : ['IN_PROGRESS', 'PENDING', 'RUNNING'].includes(normalizedRawStatus)
        ? 'RUNNING'
        : 'READY';

  let novelAnalysisStatus = 'NO_TASK';
  if (latestNovelJob?.status) {
    novelAnalysisStatus = String(latestNovelJob.status).toUpperCase();
  } else if (runningJobs.some((job) => String(job.jobType || '').includes('NOVEL'))) {
    novelAnalysisStatus = 'RUNNING';
  }

  // 映射后端项目实体至前端视图模型
  return adaptProjectDetail({
    ...raw,
    status: effectiveProjectStatus,
    stats: {
      buildsCount: episodes.length || 0,
      structuralStatus: episodes.length > 0 ? 'Audited' : 'Pending',
      usage: '--',
      novelAnalysisStatus,
      latestNovelJobId: latestNovelJob?.id || '--',
      latestNovelJobType:
        latestNovelJob?.type || latestNovelJob?.jobType || latestRunningNovelJob?.jobType || '--',
      latestNovelJobUpdatedAt:
        latestNovelJob?.updatedAt || latestNovelJob?.createdAt || raw.updatedAt || raw.createdAt || '--',
    },
    audit: {
      fingerprintStatus: 'UNKNOWN',
      rulesVersion: 'v1.1-LAUNCH',
    },
  });
}

/**
 * 获取具体项目的任务运行列表（用作构建实例列表）
 */
export async function getProjectBuilds(projectId: string): Promise<BuildRowView[]> {
  const response = await fetch(`/api/projects/${projectId}/overview/`, { cache: 'no-store' });
  const result = (await response.json()) as ApiEnvelope<ProjectOverviewApiData>;

  if (!response.ok || !result.success) {
    return [];
  }

  const runningJobs = result.data?.runningJobs || [];
  // 将运行中的 Job 映射为 UI 的构建行
  return adaptBuildsList(
    runningJobs.map((job) => ({
      id: job.id,
      name: `${job.jobType} [Task: ${job.taskId?.slice(0, 8)}]`,
      status: job.status === 'RUNNING' ? 'RUNNING' : job.status === 'SUCCESS' ? 'DONE' : 'ERROR',
      createdAt: job.createdAt,
      metrics: {
        episodes: '--',
        scenes: '--',
        shots: '1',
      },
    }))
  );
}

/**
 * 获取物理审计及取证报告大纲（从真实审计日志提取）
 */
export async function getProjectEvidenceSummary(projectId: string): Promise<EvidenceSummaryView> {
  const response = await fetch(`/api/projects/${projectId}/overview/`, { cache: 'no-store' });
  const result = (await response.json()) as ApiEnvelope<ProjectOverviewApiData>;

  if (!response.ok || !result.success) {
    throw new Error('Failed to fetch evidence summary');
  }

  const overview = result.data ?? {};
  const recentAudit = overview.auditLogs?.[0];

  return adaptEvidenceSummary({
    globalHash: recentAudit?.id ? `audit:${recentAudit.id.slice(0, 16)}` : undefined,
    cid: recentAudit?.resourceId === projectId ? 'confirmed' : undefined,
    buildId: overview.runningJobs?.[0]?.id || 'N/A',
    verified: overview.nextAction?.action?.canRun === true,
    lastGeneratedAt: overview.auditLogs?.[0]?.at || new Date().toISOString(),
    status: overview.nextAction?.action?.canRun ? 'Verified' : 'Unverified',
  });
}
