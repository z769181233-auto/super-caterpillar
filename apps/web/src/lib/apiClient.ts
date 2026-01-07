// apps/web/src/lib/apiClient.ts
// 后端基础地址，优先使用 NEXT_PUBLIC_API_URL，默认 http://localhost:3000
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

import {
  ProjectSceneGraph,
  NovelAnalysisStatus,
  ProjectOverviewDTO,
  ProjectStructureTree,
} from '@scu/shared-types';



export type UnauthorizedError = Error & { status: 401; code: 'UNAUTHORIZED' };

interface ErrorResponse {
  error?: { message?: string };
  message?: string;
  [key: string]: unknown;
}

function makeUnauthorizedError(message = 'Unauthorized'): UnauthorizedError {
  const err = new Error(message) as UnauthorizedError;
  err.status = 401;
  err.code = 'UNAUTHORIZED';
  return err;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Global 401 Handler Wrapper
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options);

  if (res.status === 401) {
    // ✅ 只抛结构化错误；跳转由 UnauthorizedRedirectProvider 统一处理（单一权威）
    throw makeUnauthorizedError('Unauthorized');
  }

  return res;
}

export const projectApi = {
  async createProject(payload: { name: string; description?: string }) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: '创建项目失败' }));
      throw new Error(error.message || `创建项目失败: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || '创建项目失败');
    }

    return json.data.project ?? json.data;
  },

  async getProjects(): Promise<ProjectDTO[]> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects`, {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    // 后端标准结构：{ success: true, data: { projects: [...] } }
    if (json && json.success && json.data && Array.isArray(json.data.projects)) {
      return json.data.projects as ProjectDTO[];
    }

    // 容错：如果 data 本身就是数组
    if (json && Array.isArray(json.data)) {
      return json.data as ProjectDTO[];
    }

    // 容错：如果直接返回数组
    if (Array.isArray(json)) {
      return json as ProjectDTO[];
    }

    return [];
  },

  async getProjectTree(projectId: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/tree`, {
      credentials: 'include',
    });

    if (!res.ok) {
      if (res.status === 404) {
        const error = new Error('项目不存在') as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }
      const error = await res.json().catch(() => ({ message: '加载项目失败' }));
      const err = new Error(error.message || `加载项目失败: ${res.status} ${res.statusText}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }

    const json = await res.json();
    if (json && json.success && json.data) {
      return json.data;
    }
    throw new Error('Invalid response format');
  },

  async getProjectSceneGraph(projectId: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/scene-graph`, {
      credentials: 'include',
    });

    if (!res.ok) {
      if (res.status === 404) {
        const error = new Error('项目不存在') as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }
      const error = await res.json().catch(() => ({ message: '加载场景图失败' }));
      const err = new Error(error.message || `加载场景图失败: ${res.status} ${res.statusText}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }

    const json = await res.json();
    if (json && json.success && json.data) {
      return json.data;
    }
  },



  // ...

  async getProjectOverview(projectId: string): Promise<ProjectOverviewDTO> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/overview`, {
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Failed to load project overview' }));
      throw new Error(error.message || `Failed to load project overview: ${res.status}`);
    }

    const json = await res.json();
    if (json && json.success && json.data) {
      return json.data as ProjectOverviewDTO;
    }
    throw new Error('Invalid response format');
  },

  async listShots(params: Record<string, unknown> = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      const v = params[key];
      if (v !== undefined && v !== null && v !== '') {
        query.append(key, String(v));
      }
    });

    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/shots?${query.toString()}`, {
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Failed to list shots' }));
      throw new Error(error.message || `Failed to list shots: ${res.status}`);
    }

    const json = await res.json();
    return json?.data ?? { shots: [], total: 0 };
  },

  async batchReview(shotIds: string[], reviewStatus: 'APPROVED' | 'REJECTED', reviewNote?: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/shots/batch/review`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shotIds, reviewStatus, reviewNote }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Batch review failed' }));
      throw new Error(error.message || `Batch review failed: ${res.status}`);
    }

    const json = await res.json();
    return json?.data ?? json;
  },

  async updateShot(shotId: string, payload: Record<string, unknown>) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/shots/${shotId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Update shot failed' }));
      throw new Error(error.message || `Update shot failed: ${res.status}`);
    }

    const json = await res.json();
    return json?.data ?? json;
  },

  async getJobsByShot(shotId: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/shots/${shotId}/jobs`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Get jobs failed' }));
      throw new Error(error.message || `Get jobs failed: ${res.status}`);
    }

    const json = await res.json();
    return json?.data ?? [];
  },

  async batchGenerate(shotIds: string[], jobType: 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO', engine?: string, engineConfig?: Record<string, unknown>) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/shots/batch/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shotIds, jobType, engine, engineConfig }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Batch generate failed' }));
      throw new Error(error.message || `Batch generate failed: ${res.status}`);
    }

    const json = await res.json();
    return json?.data ?? json;
  },

  async generateStructure(projectId: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/structure/generate`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Structure generation failed' }));
      throw new Error(error.message || `Structure generation failed: ${res.status}`);
    }

    const json = await res.json();
    if (json.success) {
      return json.data;
    }
    throw new Error(json.error?.message || 'Structure generation failed');
  },

  // S3-D: 获取项目结构树 (Authoritative)
  async getProjectStructure(projectId: string): Promise<ProjectStructureTree> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/structure`, {
      credentials: 'include',
    });

    if (!res.ok) {
      if (res.status === 404) {
        const error = new Error('项目不存在') as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }
      const error = await res.json().catch(() => ({ message: '加载项目结构失败' }));
      const err = new Error(error.message || `加载项目结构失败: ${res.status} ${res.statusText}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }

    const json = await res.json();
    if (json && json.success && json.data) {
      return json.data as ProjectStructureTree;
    }
    throw new Error('Invalid response format');
  },

  // Stage4: Scene Semantic Enhancement (MVP)
  async getSceneSemanticEnhancement(projectId: string, sceneId: string) {
    const res = await fetchWithAuth(
      `${API_BASE_URL}/api/projects/${projectId}/scenes/${sceneId}/semantic-enhancement`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      const err = new Error(`加载语义信息失败: ${res.status} ${res.statusText}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }
    const json = await res.json();
    return json.data || null;
  },

  async runSceneSemanticEnhancement(projectId: string, sceneId: string) {
    const res = await fetchWithAuth(
      `${API_BASE_URL}/api/projects/${projectId}/scenes/${sceneId}/semantic-enhancement`,
      { method: 'POST', credentials: 'include' },
    );
    if (!res.ok) {
      const err = new Error(`生成语义信息失败: ${res.status} ${res.statusText}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }
    const json = await res.json();
    return json.data || null;
  },

  // Stage4: Shot Planning (MVP)
  async getShotPlanning(projectId: string, shotId: string) {
    const res = await fetchWithAuth(
      `${API_BASE_URL}/api/projects/${projectId}/shots/${shotId}/shot-planning`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      const err = new Error(`加载镜头规划失败: ${res.status} ${res.statusText}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }
    const json = await res.json();
    return json.data || null;
  },

  async runShotPlanning(projectId: string, shotId: string) {
    const res = await fetchWithAuth(
      `${API_BASE_URL}/api/projects/${projectId}/shots/${shotId}/shot-planning`,
      { method: 'POST', credentials: 'include' },
    );
    if (!res.ok) {
      const err = new Error(`生成镜头规划失败: ${res.status} ${res.statusText}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }
    const json = await res.json();
    return json.data || null;
  },

  // Stage4: Structure QA (MVP)
  async getStructureQualityReport(projectId: string) {
    const res = await fetchWithAuth(
      `${API_BASE_URL}/api/projects/${projectId}/structure-quality/report`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      const err = new Error(`加载质量报告失败: ${res.status} ${res.statusText}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }
    const json = await res.json();
    return json.data || null;
  },

  async runStructureQualityAssess(projectId: string) {
    const res = await fetchWithAuth(
      `${API_BASE_URL}/api/projects/${projectId}/structure-quality/assess`,
      { method: 'POST', credentials: 'include' },
    );
    if (!res.ok) {
      const err = new Error(`评估结构质量失败: ${res.status} ${res.statusText}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }
    const json = await res.json();
    return json.data || null;
  },

  async getQualityReviewQueue(params: { projectId: string; status?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.limit) query.set('limit', String(params.limit));

    const res = await fetchWithAuth(
      `${API_BASE_URL}/api/projects/${params.projectId}/quality/review-queue?${query.toString()}`,
      { credentials: 'include' }
    );
    if (!res.ok) {
      const err = new Error(`加载审核队列失败: ${res.status}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }
    const json = await res.json();
    return json.data || [];
  },

  async manualRerunQualityDecision(auditId: string, note?: string) {
    const res = await fetchWithAuth(
      `${API_BASE_URL}/api/projects/quality/review-queue/${auditId}/rerun`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      }
    );
    if (!res.ok) {
      const err = new Error(`重新运行质量决策失败: ${res.status}`) as Error & { statusCode?: number };
      err.statusCode = res.status;
      throw err;
    }
    const json = await res.json();
    return json.data || json;
  },
};

// User API
export const userApi = {
  async getCurrentUser() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/users/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      // 401 is already handled by fetchWithAuth throwing UnauthorizedError
      // Only handle other errors here
      const error = await res.json().catch(() => ({ message: 'Failed to get current user' }));
      throw new Error(error.message || `Failed to get current user: ${res.status}`);
    }

    const json = await res.json();
    return json?.data ?? json;
  },
};

// Organization API
export const organizationApi = {
  async getUserOrganizations() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/organizations`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Failed to get organizations' }));
      throw new Error(error.message || `Failed to get organizations: ${res.status}`);
    }

    const json = await res.json();
    return json?.data ?? [];
  },

  async switchOrganization(organizationId: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/organizations/switch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ organizationId }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Failed to switch organization' }));
      throw new Error(error.message || `Failed to switch organization: ${res.status}`);
    }

    const json = await res.json();
    return json?.data ?? json;
  },
};

// Auth API
export const authApi = {
  async login(email: string, password: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 重要：包含 cookie
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(error.message || `Login failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (json && json.success && json.data) {
      return json.data;
    }
    throw new Error('Invalid response format');
  },

  async logout() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Logout failed: ${res.status} ${res.statusText}`);
    }

    return await res.json();
  },

  async register(email: string, password: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Registration failed' }));
      throw new Error(error.message || `Registration failed: ${res.status}`);
    }

    const json = await res.json();
    if (json && json.success && json.data) {
      return json.data;
    }
    throw new Error('Invalid response format');
  },
};

export const novelImportApi = {
  async importNovelFile(projectId: string, file: File): Promise<ImportNovelResultDTO> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/novel/import-file`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const json: unknown = await safeJson(res);
    const obj = (json && typeof json === 'object') ? (json as ErrorResponse) : null;

    if (!res.ok) {
      const msg =
        obj?.error?.message ||
        obj?.message ||
        `上传失败 (${res.status})`;
      throw new Error(msg);
    }

    // 预期结构：{ success: true, data: { novelName, author, fileUrl, ... } }
    return (obj?.data ?? json) as ImportNovelResultDTO;
  },

  async importNovel(projectId: string, payload: { novelName: string; author: string; fileUrl: string }): Promise<ImportNovelResultDTO> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/novel/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    const json: unknown = await safeJson(res);
    const obj = (json && typeof json === 'object') ? (json as ErrorResponse) : null;

    if (!res.ok) {
      const msg =
        obj?.error?.message ||
        obj?.message ||
        `导入失败 (${res.status})`;
      throw new Error(msg);
    }

    // 预期结构：{ success: true, data: { projectId, novelSourceId, ... } }
    return (obj?.data ?? json) as ImportNovelResultDTO;
  },

  async analyzeNovel(projectId: string): Promise<ImportNovelResultDTO> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/novel/analyze`, {
      method: 'POST',
      credentials: 'include',
    });

    const json: unknown = await safeJson(res);
    const obj = (json && typeof json === 'object') ? (json as ErrorResponse) : null;

    if (!res.ok) {
      const msg =
        obj?.error?.message ||
        obj?.message ||
        `分析失败 (${res.status})`;
      throw new Error(msg);
    }

    // 预期结构：{ success: true, data: { jobId, ... } }
    return (obj?.data ?? json) as ImportNovelResultDTO;
  },

  async getNovelJobs(projectId: string): Promise<JobDTO[]> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/novel/jobs`, {
      method: 'GET',
      credentials: 'include',
    });

    const json: unknown = await safeJson(res);
    const obj = (json && typeof json === 'object') ? (json as ErrorResponse) : null;

    if (!res.ok) {
      const msg =
        obj?.error?.message ||
        obj?.message ||
        `获取任务失败 (${res.status})`;
      throw new Error(msg);
    }

    // 预期结构：{ success: true, data: { jobs: [...] } } 或 { success: true, data: [...] }
    const data = obj?.data ?? json;
    if (Array.isArray(data)) return data as JobDTO[];

    // Checked safe access
    const dataObj = data as { jobs?: unknown[] };
    if (data && typeof data === 'object' && Array.isArray(dataObj.jobs)) return dataObj.jobs as JobDTO[];
    return [];
  },
};

import type { WorkerStatsDTO, OrchestratorStatsDTO, ListJobsResponse, JobDTO, ProjectDTO, ProjectDetailDTO, ImportNovelResultDTO } from '@/types/dto';

// ================= Worker Monitor API =================
export async function getWorkerMonitorStats(signal?: AbortSignal): Promise<WorkerStatsDTO | null> {
  const res = await fetchWithAuth(`${API_BASE_URL}/api/monitor/workers`, {
    signal,
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to get worker stats: ${res.status}`);
  }
  const json = await res.json();
  const data = json?.data ?? json;
  return data as WorkerStatsDTO;
}

// ================= Orchestrator Monitor API =================
export async function getOrchestratorMonitorStats(signal?: AbortSignal): Promise<OrchestratorStatsDTO | null> {
  const res = await fetchWithAuth(`${API_BASE_URL}/api/monitor/orchestrator`, {
    signal,
    credentials: 'include',
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to get orchestrator stats: ${res.status}`);
  }
  const json = await res.json();
  const data = json?.data ?? json;
  return data as OrchestratorStatsDTO;
}

// ================= Task Graph API =================
export async function getTaskGraph(taskId: string) {
  const res = await fetchWithAuth(`${API_BASE_URL}/api/tasks/${taskId}/graph`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to get task graph: ${res.status}`);
  const json = await res.json();
  return json?.data ?? json;
}

// ================= Jobs API =================
export interface ListJobsParams {
  status?: string;
  type?: string;
  processor?: string;
  shotId?: string;
  projectId?: string;
  engineKey?: string;
  signal?: AbortSignal;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface ListJobsResult {
  jobs: JobDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

class ApiClient {
  public jobs = {
    async listJobs(params: ListJobsParams = {}): Promise<ListJobsResult> {
      const query = new URLSearchParams();
      if (params.status && params.status !== 'ALL') query.set('status', params.status);
      if (params.type && params.type !== 'ALL') query.set('type', params.type);
      if (params.processor) query.set('processor', params.processor);
      if (params.shotId) query.set('shotId', params.shotId);
      if (params.projectId) query.set('projectId', params.projectId);
      if (params.engineKey) query.set('engineKey', params.engineKey);
      if (params.from) query.set('from', params.from);
      if (params.to) query.set('to', params.to);
      if (params.page != null) query.set('page', String(params.page));
      if (params.pageSize != null) query.set('pageSize', String(params.pageSize));

      const res = await fetchWithAuth(`${API_BASE_URL}/api/jobs?${query.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: params.signal,
      });

      if (!res.ok) {
        throw new Error(`Failed to list jobs: ${res.status}`);
      }

      const json = await res.json();
      const data = json?.data ?? json;
      return {
        jobs: (data?.jobs ?? []) as JobDTO[],
        total: data?.total ?? 0,
        page: data?.page ?? params.page ?? 1,
        pageSize: data?.pageSize ?? params.pageSize ?? 20,
        totalPages: data?.totalPages ?? 1,
      };
    },

    async createJob(shotId: string, type: string, params: Record<string, unknown>, engine?: string) {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/shots/${shotId}/jobs`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...params, type, engine }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create job: ${res.status}`);
      }
      const json = await res.json();
      return json?.data ?? json;
    },

    async getJobById(id: string) {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/jobs/${id}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to get job ${id}: ${res.status}`);
      }
      const json = await res.json();
      return json?.data ?? json;
    },

    async retryJob(id: string) {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/jobs/${id}/retry`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to retry job ${id}: ${res.status}`);
      }
      const json = await res.json();
      return json?.data ?? json;
    },

    async cancelJob(id: string) {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/jobs/${id}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to cancel job ${id}: ${res.status}`);
      }
      const json = await res.json();
      return json?.data ?? json;
    },

    async forceFailJob(id: string, message?: string) {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/jobs/${id}/force-fail`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: message ? JSON.stringify({ message }) : undefined,
      });
      if (!res.ok) {
        throw new Error(`Failed to force-fail job ${id}: ${res.status}`);
      }
      const json = await res.json();
      return json?.data ?? json;
    },

    async batchRetry(jobIds: string[]) {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/jobs/batch/retry`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds }),
      });
      if (!res.ok) {
        throw new Error(`Failed to batch retry jobs: ${res.status}`);
      }
      const json = await res.json();
      return json?.data ?? json;
    },

    async batchCancel(jobIds: string[]) {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/jobs/batch/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds }),
      });
      if (!res.ok) {
        throw new Error(`Failed to batch cancel jobs: ${res.status}`);
      }
      const json = await res.json();
      return json?.data ?? json;
    },

    async batchForceFail(jobIds: string[], note?: string) {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/jobs/batch/force-fail`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds, note }),
      });
      if (!res.ok) {
        throw new Error(`Failed to batch force-fail jobs: ${res.status}`);
      }
      const json = await res.json();
      return json?.data ?? json;
    },
  };

  // Add more job-related methods here if needed
}

export const apiClient = new ApiClient();
export const jobApi = apiClient.jobs;

// Add engineApi and extendedJobApi back if they were part of the file
export const engineApi = {
  async getEngines() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/engines`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to fetch engines: ${res.status}`);
    const json = await res.json();
    return json?.data ?? json;
  },

  // Alias for backward compatibility
  async listEngines() {
    return engineApi.getEngines();
  },

  async syncEngines() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/engines/sync`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to sync engines: ${res.status}`);
    const json = await res.json();
    return json?.data ?? json;
  },
};

export const extendedJobApi = {
  async getEngineSummary(engineKey: string, projectId: string) {
    const query = new URLSearchParams({ engineKey, projectId });
    const res = await fetchWithAuth(`${API_BASE_URL}/api/jobs/engine-summary?${query.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Failed to get engine summary: ${res.status}`);
    const json = await res.json();
    return json?.data ?? json;
  },
};
// ================= Pipeline Control API =================
export const pipelineApi = {
  async getPipeline(projectId: string, signal?: AbortSignal) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/pipeline`, {
      credentials: 'include',
      signal,
    });
    if (!res.ok) throw new Error(`Failed to get pipeline: ${res.status}`);
    const json = await res.json();
    return json?.data ?? json;
  },

  async retryNode(projectId: string, nodeId: string, reason?: string, signal?: AbortSignal) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/pipeline/nodes/${encodeURIComponent(nodeId)}/retry`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      signal,
    });
    if (!res.ok) throw new Error(`Failed to retry node: ${res.status}`);
    const json = await res.json();
    return json?.data ?? json;
  },

  async skipNode(projectId: string, nodeId: string, reason: string, signal?: AbortSignal) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/pipeline/nodes/${encodeURIComponent(nodeId)}/skip`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      signal,
    });
    if (!res.ok) throw new Error(`Failed to skip node: ${res.status}`);
    const json = await res.json();
    return json?.data ?? json;
  },

  async forcePassNode(projectId: string, nodeId: string, reason: string, signal?: AbortSignal) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/projects/${projectId}/pipeline/nodes/${encodeURIComponent(nodeId)}/force-pass`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      signal,
    });
    if (!res.ok) throw new Error(`Failed to force-pass node: ${res.status}`);
    const json = await res.json();
    return json?.data ?? json;
  },
};
