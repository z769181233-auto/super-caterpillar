'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { jobApi } from '@/lib/apiClient';
import { getJobStatusText, JobStatus } from '@/lib/status';
import { ProjectPermissions } from '@/lib/permissions';
import EngineFilter from '@/components/engines/EngineFilter';
import EngineSummaryPanel from '@/components/engines/EngineSummaryPanel';
import EngineProfilePanel from '@/components/engines/EngineProfilePanel';
import EngineTag from '@/components/engines/EngineTag';
import AdapterBadge from '@/components/engines/AdapterBadge';
import QualityScoreBadge from '@/components/quality/QualityScoreBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DetailDrawer } from '@/components/_legacy/ui/DetailDrawer';

interface Job {
  id: string;
  type: string;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  scheduledAt?: string;
  lockedAt?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  lastError?: string;
  processor: string;
  shotId: string;
  shotTitle?: string;
  projectName: string;
  // S3-C.1: 新增字段
  engineKey?: string;
  engineVersion?: string | null;
  adapterName?: string;
  qualityScore?: {
    score?: number | null;
    confidence?: number | null;
  } | null;
}

// 权限状态（占位，后续从用户信息或权限接口获取）
interface UserPermissions {
  projectRead?: boolean;
  projectWrite?: boolean;
  projectReview?: boolean;
}

// 类型映射：英文 → 中文
const typeMap: Record<string, string> = {
  IMAGE: '图片任务',
  VIDEO: '视频任务',
  STORYBOARD: '故事板任务',
  AUDIO: '音频任务',
  LLM: '文本任务',
  TEXT: '文本任务',
  MOCK: '模拟任务',
  NOVEL_ANALYSIS: '小说分析',
  NOVEL_ANALYZE_CHAPTER: '章节分析',
};

// 处理器映射：英文 → 中文
const processorMap: Record<string, string> = {
  internal_prod: '内部真值处理器',
  sd: 'SD 图片模型',
  outline: '大纲分析',
  'novel-analysis': '小说分析处理器',
  'novel-chapter-analysis': '章节分析处理器',
};

// 格式化处理器名称（允许为空）
const formatProcessor = (processor?: string | null): string => {
  // 为空时直接返回占位
  if (!processor) {
    return '未设置';
  }

  const key = processor.toLowerCase();

  if (processorMap[key]) {
    return processorMap[key];
  }

  // 默认首字母大写
  return processor.charAt(0).toUpperCase() + processor.slice(1);
};

// 时间范围映射
const timeRangeMap: Record<string, string> = {
  '1h': '最近 1 小时',
  '24h': '最近 24 小时',
  '7d': '最近 7 天',
  '30d': '最近 30 天',
  all: '全部时间',
};

function JobDashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProjectId = searchParams?.get('projectId') || '';
  const initialType = searchParams?.get('type') || '';
  const initialEngineKey = searchParams?.get('engineKey') || '';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [operating, setOperating] = useState(false);
  const [showForceFailDialog, setShowForceFailDialog] = useState(false);
  const [forceFailMessage, setForceFailMessage] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);

  // 权限状态（占位，后续从用户信息或权限接口获取）
  const [permissions, setPermissions] = useState<UserPermissions>({
    projectRead: true, // 默认有权限，后续从接口获取
    projectWrite: true,
    projectReview: true,
  });

  // 过滤条件
  const [filters, setFilters] = useState({
    status: '',
    type: initialType,
    processor: '',
    shotId: '',
    projectId: initialProjectId,
    engineKey: initialEngineKey, // S3-C.1: 新增 engineKey 筛选
    timeRange: '24h', // 1h, 24h, 7d, 30d, all
    page: 1,
    pageSize: 20,
  });

  const [stats, setStats] = useState({
    total: 0,
    byStatus: {} as Record<string, number>,
    failedLast24h: 0,
  });

  // S3-C.2: 分组查看模式
  const [groupBy, setGroupBy] = useState<'none' | 'engine' | 'version'>('none');

  // S4-A: 引擎画像面板折叠状态
  const [showEngineProfile, setShowEngineProfile] = useState(false);

  // S3-C.2: 监听 URL 变化，自动更新 filters 并刷新数据
  useEffect(() => {
    const urlEngineKey = searchParams?.get('engineKey') || '';
    const urlProjectId = searchParams?.get('projectId') || '';
    const urlType = searchParams?.get('type') || '';

    if (
      urlEngineKey !== filters.engineKey ||
      urlProjectId !== filters.projectId ||
      urlType !== filters.type
    ) {
      setFilters((prev) => ({
        ...prev,
        engineKey: urlEngineKey,
        projectId: urlProjectId,
        type: urlType,
        page: 1, // 重置到第一页
      }));
    }
  }, [searchParams]);

  useEffect(() => {
    loadJobs();
  }, [filters]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError('');

      // 计算时间范围
      const now = new Date();
      let from: string | undefined;
      if (filters.timeRange === '1h') {
        from = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      } else if (filters.timeRange === '24h') {
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      } else if (filters.timeRange === '7d') {
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (filters.timeRange === '30d') {
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const result = await jobApi.listJobs({
        ...filters,
        from,
        status: filters.status || undefined,
        type: filters.type || undefined,
        processor: filters.processor || undefined,
        shotId: filters.shotId || undefined,
        projectId: filters.projectId || undefined,
        engineKey: filters.engineKey || undefined, // S3-C.1: 传递 engineKey 筛选
      });

      const jobList = (result.jobs || []) as any[]; // Cast to any[] to match State Job[]
      setJobs(jobList);

      // 计算统计
      const total = result?.total || jobList.length || 0;
      const byStatus: Record<string, number> = {};
      let failedLast24h = 0;

      jobList.forEach((job: Job) => {
        byStatus[job.status] = (byStatus[job.status] || 0) + 1;
        if (job.status === 'FAILED' && job.finishedAt) {
          const finishedAt = new Date(job.finishedAt);
          if (finishedAt > new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
            failedLast24h++;
          }
        }
      });

      setStats({ total, byStatus, failedLast24h });
    } catch (err: any) {
      if (err.statusCode === 401) {
        router.push('/login');
      } else {
        setError(err.message || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadJobDetail = async (jobId: string) => {
    try {
      const detail = await jobApi.getJobById(jobId);
      setJobDetail(detail);
    } catch (err: any) {
      alert(err.message || '加载详情失败');
    }
  };

  const handleSelectJob = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedJobs.size === jobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(jobs.map((j) => j.id)));
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      setOperating(true);
      await jobApi.retryJob(jobId);
      await loadJobs();
      if (selectedJob?.id === jobId) {
        await loadJobDetail(jobId);
      }
    } catch (err: any) {
      alert(err.message || '重试失败');
    } finally {
      setOperating(false);
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      setOperating(true);
      await jobApi.cancelJob(jobId);
      await loadJobs();
      if (selectedJob?.id === jobId) {
        await loadJobDetail(jobId);
      }
    } catch (err: any) {
      alert(err.message || '取消失败');
    } finally {
      setOperating(false);
    }
  };

  const handleForceFail = async (jobId: string, message?: string) => {
    try {
      setOperating(true);
      await jobApi.forceFailJob(jobId, message);
      await loadJobs();
      if (selectedJob?.id === jobId) {
        await loadJobDetail(jobId);
      }
      setShowForceFailDialog(false);
      setForceFailMessage('');
    } catch (err: any) {
      alert(err.message || '强制失败失败');
    } finally {
      setOperating(false);
    }
  };

  const handleBatchRetry = async () => {
    if (selectedJobs.size === 0) return;
    try {
      setOperating(true);
      await jobApi.batchRetry(Array.from(selectedJobs));
      setSelectedJobs(new Set());
      await loadJobs();
    } catch (err: any) {
      alert(err.message || '批量重试失败');
    } finally {
      setOperating(false);
    }
  };

  const handleBatchCancel = async () => {
    if (selectedJobs.size === 0) return;
    try {
      setOperating(true);
      await jobApi.batchCancel(Array.from(selectedJobs));
      setSelectedJobs(new Set());
      await loadJobs();
    } catch (err: any) {
      alert(err.message || '批量取消失败');
    } finally {
      setOperating(false);
    }
  };

  const handleBatchForceFail = async () => {
    if (selectedJobs.size === 0) return;
    if (!forceFailMessage.trim()) {
      alert('请输入失败原因');
      return;
    }
    try {
      setOperating(true);
      await jobApi.batchForceFail(Array.from(selectedJobs), forceFailMessage);
      setSelectedJobs(new Set());
      setShowForceFailDialog(false);
      setForceFailMessage('');
      await loadJobs();
    } catch (err: any) {
      alert(err.message || '批量强制失败失败');
    } finally {
      setOperating(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: '#999',
    RUNNING: '#FF9800',
    SUCCEEDED: '#4CAF50',
    FAILED: '#F44336',
    CANCELLED: '#9E9E9E',
    FORCE_FAILED: '#D32F2F',
    QUEUED: '#2196F3',
  };

  const formatJobId = (id: string) => id.substring(0, 8) + '...';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      {/* 左侧过滤栏 */}
      <div
        style={{
          width: '280px',
          borderRight: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
          padding: '1.5rem',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>筛选条件</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              状态
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">全部</option>
              <option value="PENDING">等待中</option>
              <option value="RUNNING">执行中</option>
              <option value="SUCCEEDED">已完成</option>
              <option value="FAILED">失败</option>
              <option value="CANCELLED">已取消</option>
              <option value="FORCE_FAILED">强制失败</option>
              <option value="QUEUED">排队中</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              类型
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">全部</option>
              <option value="IMAGE">图片任务</option>
              <option value="VIDEO">视频任务</option>
              <option value="STORYBOARD">故事板任务</option>
              <option value="AUDIO">音频任务</option>
              <option value="LLM">文本任务</option>
              <option value="TEXT">文本任务</option>
              <option value="MOCK">模拟任务</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              处理器
            </label>
            <select
              value={filters.processor}
              onChange={(e) => setFilters({ ...filters, processor: e.target.value, page: 1 })}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">全部</option>
              <option value="internal_prod">内部真值处理器</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              时间范围
            </label>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters({ ...filters, timeRange: e.target.value, page: 1 })}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="1h">最近 1 小时</option>
              <option value="24h">最近 24 小时</option>
              <option value="7d">最近 7 天</option>
              <option value="30d">最近 30 天</option>
              <option value="all">全部时间</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              镜头 ID
            </label>
            <input
              type="text"
              value={filters.shotId}
              onChange={(e) => setFilters({ ...filters, shotId: e.target.value, page: 1 })}
              placeholder="镜头 ID"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              项目 ID
            </label>
            <input
              type="text"
              value={filters.projectId}
              onChange={(e) => setFilters({ ...filters, projectId: e.target.value, page: 1 })}
              placeholder="项目 ID"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </div>

          {/* S3-C.1: Engine 筛选器 */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '0.25rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              引擎
            </label>
            <EngineFilter
              queryParam="engineKey"
              showAll={true}
              defaultValue={null}
              onChange={(engineKey) => {
                setFilters({ ...filters, engineKey: engineKey || '', page: 1 });
              }}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            />
          </div>

          <button
            onClick={() => {
              setFilters({
                status: '',
                type: '',
                processor: '',
                shotId: '',
                projectId: '',
                engineKey: '', // S3-C.1: 清除 engineKey 筛选
                timeRange: '24h',
                page: 1,
                pageSize: 20,
              });
            }}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: '#f0f0f0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            清除筛选
          </button>
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* S3-C.2: Engine 质量摘要面板 */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: '#fafafa',
          }}
        >
          <EngineSummaryPanel projectId={filters.projectId || undefined} />
        </div>

        {/* S4-A: 引擎画像面板（可折叠） */}
        <div style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: 'white' }}>
          <button
            onClick={() => setShowEngineProfile(!showEngineProfile)}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              textAlign: 'left',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            <span>引擎画像统计</span>
            <span>{showEngineProfile ? '▼' : '▶'}</span>
          </button>
          {showEngineProfile && (
            <div style={{ padding: '0 1.5rem 1rem 1.5rem' }}>
              <EngineProfilePanel
                engineKey={filters.engineKey || undefined}
                projectId={filters.projectId || undefined}
              />
            </div>
          )}
        </div>

        {/* 统计条 */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: 'white',
            display: 'flex',
            gap: '2rem',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '0.875rem', color: '#666' }}>总计: </span>
            <span style={{ fontSize: '1rem', fontWeight: 600 }}>{stats.total}</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status}>
                <span style={{ fontSize: '0.75rem', color: '#666' }}>
                  {getJobStatusText(status)}:{' '}
                </span>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: statusColors[status] || '#666',
                  }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#666' }}>最近 24h 失败: </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F44336' }}>
              {stats.failedLast24h}
            </span>
          </div>
        </div>

        {/* 批量操作栏 */}
        {selectedJobs.size > 0 && (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              borderBottom: '1px solid #e0e0e0',
              backgroundColor: '#e3f2fd',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.875rem', marginRight: '0.5rem' }}>
              已选择 {selectedJobs.size} 项
            </span>
            <button
              onClick={handleBatchRetry}
              disabled={operating}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: operating ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: operating ? 'not-allowed' : 'pointer',
              }}
            >
              批量重试
            </button>
            <button
              onClick={handleBatchCancel}
              disabled={operating}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: operating ? '#ccc' : '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: operating ? 'not-allowed' : 'pointer',
              }}
            >
              批量取消
            </button>
            <button
              onClick={() => setShowForceFailDialog(true)}
              disabled={operating}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: operating ? '#ccc' : '#F44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: operating ? 'not-allowed' : 'pointer',
              }}
            >
              批量强制失败
            </button>
            <button
              onClick={() => setSelectedJobs(new Set())}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                backgroundColor: '#f0f0f0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              取消选择
            </button>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Jobs 表格 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
            {/* S3-C.2: 分组查看按钮 */}
            <div
              style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
            >
              <span style={{ fontSize: '0.875rem', color: '#666', marginRight: '0.5rem' }}>
                分组查看:
              </span>
              <button
                onClick={() => setGroupBy(groupBy === 'engine' ? 'none' : 'engine')}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  backgroundColor: groupBy === 'engine' ? '#1677ff' : '#f0f0f0',
                  color: groupBy === 'engine' ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                按 Engine 分组
              </button>
              <button
                onClick={() => setGroupBy(groupBy === 'version' ? 'none' : 'version')}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  backgroundColor: groupBy === 'version' ? '#1677ff' : '#f0f0f0',
                  color: groupBy === 'version' ? 'white' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                按 Version 分组
              </button>
            </div>

            {groupBy === 'none' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={selectedJobs.size === jobs.length && jobs.length > 0}
                        onChange={handleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                      任务 ID
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>类型</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>状态</th>
                    {/* S3-C.1: 新增 Engine 相关列 */}
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>引擎</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>版本</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                      适配器
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                      质量评分
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                      处理器
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                      重试次数
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                      优先级
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                      创建时间
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>
                      更新时间
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>错误</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>关联</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      style={{
                        borderBottom: '1px solid #f0f0f0',
                        backgroundColor: selectedJobs.has(job.id) ? '#e3f2fd' : 'white',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setSelectedJob(job);
                        loadJobDetail(job.id);
                      }}
                    >
                      <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedJobs.has(job.id)}
                          onChange={() => handleSelectJob(job.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td
                        style={{
                          padding: '0.75rem',
                          fontFamily: 'monospace',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <span
                          title={job.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(job.id);
                            alert('已复制任务 ID');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {formatJobId(job.id)}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>{typeMap[job.type] || job.type}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <StatusBadge
                          status={job.status}
                          showPulse={job.status === 'RUNNING'}
                          size="sm"
                        />
                      </td>
                      {/* S3-C.3: 使用统一组件展示 Engine 相关信息 */}
                      <td style={{ padding: '0.75rem' }}>
                        <EngineTag
                          engineKey={job.engineKey || 'default_novel_analysis'}
                          engineVersion={job.engineVersion}
                          size="sm"
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {job.engineVersion ? (
                          <span style={{ fontSize: '0.8125rem', color: '#666' }}>
                            {job.engineVersion}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {job.adapterName ? (
                          <AdapterBadge adapterName={job.adapterName} size="sm" />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <QualityScoreBadge
                          score={job.qualityScore?.score}
                          confidence={job.qualityScore?.confidence}
                          showConfidence={true}
                          size="sm"
                          variant="text"
                        />
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8125rem' }}>
                        {formatProcessor(job.processor)}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8125rem' }}>
                        {job.attempts} / {job.maxAttempts}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8125rem' }}>{job.priority}</td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#666' }}>
                        {new Date(job.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#666' }}>
                        {job.finishedAt ? new Date(job.finishedAt).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td
                        style={{
                          padding: '0.75rem',
                          fontSize: '0.75rem',
                          color: '#F44336',
                          maxWidth: '200px',
                        }}
                      >
                        {job.lastError ? (
                          <span
                            title={job.lastError}
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {job.lastError.substring(0, 30)}...
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: '#666' }}>
                        <div>{job.projectName}</div>
                        {job.shotTitle && (
                          <div style={{ fontSize: '0.75rem', color: '#999' }}>{job.shotTitle}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
                            <button
                              onClick={() => handleRetry(job.id)}
                              disabled={operating}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: operating ? '#ccc' : '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: operating ? 'not-allowed' : 'pointer',
                              }}
                            >
                              重试
                            </button>
                          )}
                          {(job.status === 'PENDING' || job.status === 'RUNNING') && (
                            <button
                              onClick={() => handleCancel(job.id)}
                              disabled={operating}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: operating ? '#ccc' : '#FF9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: operating ? 'not-allowed' : 'pointer',
                              }}
                            >
                              取消
                            </button>
                          )}
                          {(job.status === 'PENDING' || job.status === 'RUNNING') && (
                            <button
                              onClick={() => {
                                setSelectedJob(job);
                                setShowForceFailDialog(true);
                              }}
                              disabled={operating}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: operating ? '#ccc' : '#F44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: operating ? 'not-allowed' : 'pointer',
                              }}
                            >
                              强制停止
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              // S3-C.2: 分组视图
              (() => {
                // 分组逻辑
                const groupedJobs: Record<string, Job[]> = {};
                for (const job of jobs) {
                  const key =
                    groupBy === 'engine'
                      ? job.engineKey || '未知引擎'
                      : groupBy === 'version'
                        ? `${job.engineKey || '未知引擎'}@${job.engineVersion || '未知版本'}`
                        : '';
                  if (!groupedJobs[key]) {
                    groupedJobs[key] = [];
                  }
                  groupedJobs[key].push(job);
                }

                const groups = Object.entries(groupedJobs).sort(([a], [b]) => a.localeCompare(b));

                return (
                  <div>
                    {groups.map(([groupKey, groupJobs]) => (
                      <div key={groupKey} style={{ marginBottom: '2rem' }}>
                        <div
                          style={{
                            padding: '0.75rem 1rem',
                            backgroundColor: '#f5f5f5',
                            borderBottom: '2px solid #e0e0e0',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                          }}
                        >
                          {groupBy === 'engine' ? (
                            <>
                              <span className="font-mono text-xs">{groupKey}</span>
                              <span
                                style={{ marginLeft: '0.5rem', color: '#666', fontWeight: 400 }}
                              >
                                ({groupJobs.length} 条)
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-xs">{groupKey}</span>
                              <span
                                style={{ marginLeft: '0.5rem', color: '#666', fontWeight: 400 }}
                              >
                                ({groupJobs.length} 条)
                              </span>
                            </>
                          )}
                        </div>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.875rem',
                          }}
                        >
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={groupJobs.every((j) => selectedJobs.has(j.id))}
                                  onChange={() => {
                                    const allSelected = groupJobs.every((j) =>
                                      selectedJobs.has(j.id)
                                    );
                                    if (allSelected) {
                                      const newSelected = new Set(selectedJobs);
                                      groupJobs.forEach((j) => newSelected.delete(j.id));
                                      setSelectedJobs(newSelected);
                                    } else {
                                      const newSelected = new Set(selectedJobs);
                                      groupJobs.forEach((j) => newSelected.add(j.id));
                                      setSelectedJobs(newSelected);
                                    }
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                任务 ID
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                类型
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                状态
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                引擎
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                版本
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                适配器
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                质量评分
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                处理器
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                重试次数
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                优先级
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                创建时间
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                更新时间
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                错误
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                关联
                              </th>
                              <th
                                style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}
                              >
                                操作
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupJobs.map((job) => (
                              <tr
                                key={job.id}
                                style={{
                                  borderBottom: '1px solid #f0f0f0',
                                  backgroundColor: selectedJobs.has(job.id) ? '#e3f2fd' : 'white',
                                  cursor: 'pointer',
                                }}
                                onClick={() => {
                                  setSelectedJob(job);
                                  loadJobDetail(job.id);
                                }}
                              >
                                <td
                                  style={{ padding: '0.75rem' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedJobs.has(job.id)}
                                    onChange={() => handleSelectJob(job.id)}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                                <td
                                  style={{
                                    padding: '0.75rem',
                                    fontFamily: 'monospace',
                                    fontSize: '0.8125rem',
                                  }}
                                >
                                  <span
                                    title={job.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(job.id);
                                      alert('已复制任务 ID');
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {formatJobId(job.id)}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {typeMap[job.type] || job.type}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <StatusBadge
                                    status={job.status}
                                    showPulse={job.status === 'RUNNING'}
                                    size="sm"
                                  />
                                </td>
                                {/* S3-C.3: 使用统一组件展示 Engine 相关信息 */}
                                <td style={{ padding: '0.75rem' }}>
                                  <EngineTag
                                    engineKey={job.engineKey || 'default_novel_analysis'}
                                    engineVersion={job.engineVersion}
                                    size="sm"
                                  />
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {job.engineVersion ? (
                                    <span style={{ fontSize: '0.8125rem', color: '#666' }}>
                                      {job.engineVersion}
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {job.adapterName ? (
                                    <AdapterBadge adapterName={job.adapterName} size="sm" />
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <QualityScoreBadge
                                    score={job.qualityScore?.score}
                                    confidence={job.qualityScore?.confidence}
                                    showConfidence={true}
                                    size="sm"
                                    variant="text"
                                  />
                                </td>
                                <td style={{ padding: '0.75rem', fontSize: '0.8125rem' }}>
                                  {formatProcessor(job.processor)}
                                </td>
                                <td style={{ padding: '0.75rem', fontSize: '0.8125rem' }}>
                                  {job.attempts} / {job.maxAttempts}
                                </td>
                                <td style={{ padding: '0.75rem', fontSize: '0.8125rem' }}>
                                  {job.priority}
                                </td>
                                <td
                                  style={{
                                    padding: '0.75rem',
                                    fontSize: '0.8125rem',
                                    color: '#666',
                                  }}
                                >
                                  {new Date(job.createdAt).toLocaleString('zh-CN')}
                                </td>
                                <td
                                  style={{
                                    padding: '0.75rem',
                                    fontSize: '0.8125rem',
                                    color: '#666',
                                  }}
                                >
                                  {job.finishedAt
                                    ? new Date(job.finishedAt).toLocaleString('zh-CN')
                                    : '-'}
                                </td>
                                <td
                                  style={{
                                    padding: '0.75rem',
                                    fontSize: '0.75rem',
                                    color: '#F44336',
                                    maxWidth: '200px',
                                  }}
                                >
                                  {job.lastError ? (
                                    <span
                                      title={job.lastError}
                                      style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: 'block',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {job.lastError.substring(0, 30)}...
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td
                                  style={{
                                    padding: '0.75rem',
                                    fontSize: '0.8125rem',
                                    color: '#666',
                                  }}
                                >
                                  <div>{job.projectName}</div>
                                  {job.shotTitle && (
                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                      {job.shotTitle}
                                    </div>
                                  )}
                                </td>
                                <td
                                  style={{ padding: '0.75rem' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div
                                    style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}
                                  >
                                    {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
                                      <button
                                        onClick={() => handleRetry(job.id)}
                                        disabled={operating}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '0.75rem',
                                          backgroundColor: operating ? '#ccc' : '#4CAF50',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: operating ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        重试
                                      </button>
                                    )}
                                    {(job.status === 'PENDING' || job.status === 'RUNNING') && (
                                      <button
                                        onClick={() => handleCancel(job.id)}
                                        disabled={operating}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '0.75rem',
                                          backgroundColor: operating ? '#ccc' : '#FF9800',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: operating ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        取消
                                      </button>
                                    )}
                                    {(job.status === 'PENDING' || job.status === 'RUNNING') && (
                                      <button
                                        onClick={() => {
                                          setSelectedJob(job);
                                          setShowForceFailDialog(true);
                                        }}
                                        disabled={operating}
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '0.75rem',
                                          backgroundColor: operating ? '#ccc' : '#F44336',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: operating ? 'not-allowed' : 'pointer',
                                        }}
                                      >
                                        强制失败
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* Job 详情抽屉 */}
          <DetailDrawer
            isOpen={!!(selectedJob && jobDetail)}
            onClose={() => {
              setSelectedJob(null);
              setJobDetail(null);
            }}
            title={
              jobDetail
                ? `${typeMap[jobDetail.type] || jobDetail.type} - ${jobDetail.id.substring(0, 8)}...`
                : ''
            }
            id={jobDetail?.id || ''}
            status={jobDetail?.status || 'PENDING'}
            createdAt={jobDetail?.createdAt}
            startedAt={jobDetail?.startedAt}
            finishedAt={jobDetail?.finishedAt}
            input={jobDetail?.payload}
            output={jobDetail?.result}
            error={jobDetail?.lastError || null}
            onRetry={selectedJob ? () => handleRetry(selectedJob.id) : undefined}
            onCancel={selectedJob ? () => handleCancel(selectedJob.id) : undefined}
          >
            {/* 额外信息 */}
            {jobDetail && (
              <>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">基本信息</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>类型:</span>
                      <span>{typeMap[jobDetail.type] || jobDetail.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>处理器:</span>
                      <span>{formatProcessor(jobDetail.processor || '')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>重试次数:</span>
                      <span>
                        {jobDetail.attempts} / {jobDetail.maxAttempts}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>优先级:</span>
                      <span>{jobDetail.priority}</span>
                    </div>
                  </div>
                </div>
                {jobDetail.shot && (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">关联镜头</h4>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div>ID: {jobDetail.shot.id}</div>
                      {jobDetail.shot.title && <div>标题: {jobDetail.shot.title}</div>}
                      <div>状态: {getJobStatusText(jobDetail.shot.status)}</div>
                      {jobDetail.shot.previewUrl && (
                        <div>
                          <a
                            href={jobDetail.shot.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            预览链接
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </DetailDrawer>
        </div>

        {/* 分页 */}
        {!loading && jobs.length > 0 && (
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '0.875rem', color: '#666' }}>第 {filters.page} 页</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                disabled={filters.page === 1}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  backgroundColor: filters.page === 1 ? '#f0f0f0' : '#0070f3',
                  color: filters.page === 1 ? '#999' : 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: filters.page === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                上一页
              </button>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.8125rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 强制失败对话框 */}
      {showForceFailDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setShowForceFailDialog(false);
            setForceFailMessage('');
            setSelectedJob(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              width: '400px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>
              {selectedJobs.size > 0 ? '批量强制失败' : '强制失败任务'}
            </h3>
            <textarea
              value={forceFailMessage}
              onChange={(e) => setForceFailMessage(e.target.value)}
              placeholder="请输入失败原因"
              rows={4}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowForceFailDialog(false);
                  setForceFailMessage('');
                  setSelectedJob(null);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (selectedJobs.size > 0) {
                    handleBatchForceFail();
                  } else if (selectedJob) {
                    handleForceFail(selectedJob.id, forceFailMessage);
                  }
                }}
                disabled={operating || !forceFailMessage.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: operating || !forceFailMessage.trim() ? '#ccc' : '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: operating || !forceFailMessage.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                {operating ? '提交中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <JobDashboardPageContent />
    </Suspense>
  );
}
