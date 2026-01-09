'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { novelImportApi, engineApi, jobApi } from '@/lib/apiClient';
import { ProjectPermissions } from '@/lib/permissions';
import { getJobStatusText, JobStatus } from '@/lib/status';
import EngineFilter from '@/components/engines/EngineFilter';
import EngineSummaryPanel from '@/components/engines/EngineSummaryPanel';
import EngineTag from '@/components/engines/EngineTag';
import AdapterBadge from '@/components/engines/AdapterBadge';
import QualityScoreBadge from '@/components/quality/QualityScoreBadge';
import ProjectStructureTree from '@/components/project/ProjectStructureTree';

type NovelJob = {
  id: string;
  type?: string;
  status: JobStatus;
  createdAt?: string;
  updatedAt?: string;
  // S3-C.1: 新增字段
  engineKey?: string;
  engineVersion?: string | null;
  qualityScore?: {
    score?: number | null;
    confidence?: number | null;
  } | null;
  // S3-C.2: 新增字段（用于历史引擎对比）
  adapterName?: string;
  payload?: any;
};

// 权限状态（占位，后续从用户信息或权限接口获取）
interface UserPermissions {
  projectWrite?: boolean;
  projectGenerate?: boolean;
}

function formatFileSize(size: number): string {
  if (!size && size !== 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function ImportNovelPage({ params }: { params: { projectId: string } }) {
  const router = useRouter();
  const projectId = params.projectId;

  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const [novelName, setNovelName] = useState('');
  const [author, setAuthor] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [savingMeta, setSavingMeta] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [jobs, setJobs] = useState<NovelJob[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  // S3-C.1: Engine 选择器状态
  const [selectedEngineKey, setSelectedEngineKey] = useState<string>('default_novel_analysis');
  const [engines, setEngines] = useState<{ engineKey: string; name: string }[]>([]);
  // S3-C.2: 历史引擎对比数据
  const [historyJobs, setHistoryJobs] = useState<NovelJob[]>([]);

  // S3-D: Import Mode (File vs Text)
  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');

  // 权限状态（占位，后续从用户信息或权限接口获取）
  const [permissions, setPermissions] = useState<UserPermissions>({
    projectWrite: true, // 默认有权限，后续从接口获取
    projectGenerate: true,
  });

  // S3-C.1: 加载引擎列表
  useEffect(() => {
    engineApi
      .listEngines()
      .then((data) => {
        setEngines((data || []) as { engineKey: string; name: string }[]);
        // 默认选择 default_novel_analysis
        const defaultEngine = data?.find((e: any) => e.engineKey === 'default_novel_analysis');
        if (defaultEngine) {
          setSelectedEngineKey('default_novel_analysis');
        }
      })
      .catch((err) => {
        console.error('Failed to load engines:', err);
      });
  }, []);

  const canAnalyze = !!novelName.trim() && permissions.projectGenerate;
  const canImport = permissions.projectWrite;

  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const sortedJobs = [...safeJobs].sort((a, b) => {
    const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at; // 最新在前
  });
  const latestJobId = sortedJobs[0]?.id;

  const loadJobs = useCallback(async () => {
    try {
      const data = await novelImportApi.getNovelJobs(projectId);
      setJobs(data as unknown as NovelJob[]);
    } catch (e: unknown) {
      console.error('loadNovelJobs error', e);
    }
  }, [projectId]);

  // S3-C.2: 加载历史引擎对比数据
  const loadHistoryJobs = useCallback(async () => {
    try {
      // 复用 /api/jobs?projectId=xxx&type=NOVEL_ANALYSIS*
      // JobType enum or string literal
      const result = await jobApi.listJobs({
        projectId,
        type: 'NOVEL_ANALYSIS', // 会匹配 NOVEL_ANALYSIS 和 NOVEL_ANALYSIS_HTTP
        page: 1,
        pageSize: 10,
      });

      // result is ListJobsResponse { jobs: JobDTO[], total: number }
      const jobList = result.jobs || [];

      // 简单把 JobDTO 转成 NovelJob (compatible fields)
      const novelAnalysisJobs = jobList
        .filter((j) => !j.type || j.type.startsWith('NOVEL_ANALYSIS'))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map((j) => ({
          id: j.id,
          type: j.type,
          status: j.status as JobStatus,
          createdAt: j.createdAt || undefined,
          updatedAt: undefined, // DTO missing updatedAt
          engineKey: j.engineKey || undefined,
          payload: undefined, // DTO missing payload
        }))
        .slice(0, 5);

      setHistoryJobs(novelAnalysisJobs);
    } catch (e: unknown) {
      console.error('loadHistoryJobs error', e);
    }
  }, [projectId]);

  // 轮询 Job 状态：当 polling = true 时，每 3 秒刷新一次
  useEffect(() => {
    if (!polling) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const data = await novelImportApi.getNovelJobs(projectId);
        if (cancelled) return;
        setJobs(data as NovelJob[]);

        const last = data && (data as NovelJob[])[0];
        const doneStatuses: JobStatus[] = ['SUCCEEDED', 'FAILED', 'CANCELLED'];
        if (last && doneStatuses.includes(last.status as JobStatus)) {
          setPolling(false);
          setAnalyzing(false);
          setInfo('分析已完成，请在 Studio 中查看结构结果。');
        } else {
          setTimeout(tick, 3000);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('poll novel jobs error', e);
          setPolling(false);
          setAnalyzing(false);
        }
      }
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [polling, projectId]);

  // 页面加载时，尝试加载已有 Job
  useEffect(() => {
    loadJobs();
    loadHistoryJobs(); // S3-C.2: 加载历史引擎对比数据
  }, [loadJobs, loadHistoryJobs]);

  // Shared file processing logic
  const processFile = async (f: File) => {
    // 文件大小验证（50MB）
    const maxSize = 50 * 1024 * 1024;
    if (f.size > maxSize) {
      setError(`文件大小超过限制（最大 ${(maxSize / 1024 / 1024).toFixed(0)}MB）`);
      return;
    }

    // 重置状态
    setError(null);
    setInfo(null);
    setUploadProgress(0);
    setUploading(true);
    setFile(f);
    setFileUrl(null);
    // Actually, let's keep it simple and just clear if file upload
    if (importMode === 'file') {
      setNovelName('');
      setAuthor('');
    }

    try {
      // 模拟上传进度（平滑过渡）
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // 调用上传 API
      const data = await novelImportApi.importNovelFile(projectId, f);

      // 清除进度模拟
      clearInterval(progressInterval);
      setUploadProgress(100);

      // 从后端响应中提取基本信息
      const backendNovelName = data.novelName || '';
      const backendAuthor = data.author || '';

      // 如果后端没识别出来，就从文件名简单拆一下
      const nameFromFile = f.name.replace(/\.[^/.]+$/, '');

      // Update name logic: Use backend name -> then file name -> keep existing if pasting text
      if (backendNovelName) {
        setNovelName(backendNovelName);
      } else if (importMode === 'file' && nameFromFile) {
        setNovelName(nameFromFile);
      } else if (importMode === 'text' && !novelName) {
        setNovelName('Untitiled Imported Text');
      }

      setAuthor(backendAuthor || '');

      // 提取 fileUrl
      const url = data.fileUrl || data.url || '';
      setFileUrl(url || null);

      // 设置成功信息
      setInfo(
        url
          ? '文件上传成功，请确认基本信息后点击「开始分析」。'
          : '文件上传成功，未返回 fileUrl，依然可以开始分析（将走队列化处理）。'
      );
    } catch (err: unknown) {
      console.error('文件上传失败:', err);

      // 详细的错误处理
      let errorMessage = '上传失败';
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      // Simple error extraction for unknown types
      if (typeof err === 'object' && err !== null) {
        const e = err as any;
        if (e.message) errorMessage = e.message;
        else if (e.response?.data?.message) errorMessage = e.response.data.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(errorMessage);
      setUploadProgress(0);
      setFile(null);
      setFileUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // 文件类型验证
    const allowedTypes = ['.txt', '.md', '.markdown', '.doc', '.docx'];
    const fileExt = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      setError(`不支持的文件格式。支持格式：${allowedTypes.join(', ')}`);
      return;
    }

    await processFile(f);
  };

  const handleTextUpload = async () => {
    if (!rawText.trim()) return;

    // Create a blob/file from text
    const blob = new Blob([rawText], { type: 'text/plain' });
    const f = new File([blob], 'imported_text.txt', { type: 'text/plain' });

    await processFile(f);
  };

  const handleSaveMeta = async () => {
    if (!novelName.trim()) {
      setError('小说名不能为空。');
      return;
    }
    setError(null);
    setInfo(null);
    setSavingMeta(true);
    try {
      await novelImportApi.importNovel(projectId, {
        novelName: novelName.trim(),
        author: author.trim(),
        fileUrl,
      });
      setInfo('基本信息已保存。');
    } catch (err: any) {
      console.error(err);
      setError(err.message || '保存基本信息失败');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleAnalyze = async () => {
    setError(null);
    setInfo(null);
    setAnalyzing(true);
    setPolling(true);
    try {
      await novelImportApi.analyzeNovel(projectId);
      setInfo('分析任务已创建，正在分析中……');
      // 轮询由 polling useEffect 负责
    } catch (err: any) {
      console.error(err);
      setError(err.message || '启动分析失败');
      setAnalyzing(false);
      setPolling(false);
    }
  };

  const handleBack = () => {
    router.push(`/projects/${projectId}`);
  };

  return (
    <div
      style={{
        padding: '32px 40px',
        minHeight: '100vh',
        backgroundColor: '#020617', // 带一点蓝的深色，和首页色调接近
        color: '#e5e7eb',
      }}
    >
      <div
        style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: '#f9fafb' }}>
            导入小说
          </h1>
          <p style={{ marginTop: '8px', color: '#9ca3af' }}>
            上传小说文件，系统将自动解析并生成 Season / Episode / Scene / Shot 结构。
          </p>
        </div>
        <button
          onClick={handleBack}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #ddd',
            backgroundColor: '#fff',
            cursor: 'pointer',
          }}
        >
          返回项目
        </button>
      </div>

      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: '#ffe6e6',
            color: '#b00020',
          }}
        >
          {error}
        </div>
      )}

      {info && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: '#e6f4ff',
            color: '#0555aa',
          }}
        >
          {info}
        </div>
      )}

      {/* S3-C.2: 两列布局：左侧主要内容，右侧 Engine 质量摘要 */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* 左侧主要内容 */}
        <div style={{ flex: 1 }}>
          {/* 上传区域 */}
          <div
            style={{
              borderRadius: '8px',
              border: '1px solid #1f2937',
              padding: '24px',
              marginBottom: '24px',
              backgroundColor: '#0b1120',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>导入来源</h2>

            {/* Tab Switcher */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '16px',
                borderBottom: '1px solid #eee',
              }}
            >
              <button
                onClick={() => setImportMode('file')}
                style={{
                  padding: '8px 0',
                  borderBottom: importMode === 'file' ? '2px solid #1677ff' : 'none',
                  color: importMode === 'file' ? '#1677ff' : '#666',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                }}
              >
                文件上传
              </button>
              <button
                onClick={() => setImportMode('text')}
                style={{
                  padding: '8px 0',
                  borderBottom: importMode === 'text' ? '2px solid #1677ff' : 'none',
                  color: importMode === 'text' ? '#1677ff' : '#666',
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                }}
              >
                直接粘贴文本
              </button>
            </div>

            {importMode === 'file' ? (
              <>
                <p style={{ marginBottom: '16px', color: '#9ca3af' }}>
                  支持 TXT / Markdown 等纯文本格式，文件体积建议控制在数 MB 以内。
                </p>

                <label
                  style={{
                    display: canImport ? 'inline-flex' : 'none',
                    alignItems: 'center',
                    padding: '10px 18px',
                    borderRadius: '6px',
                    backgroundColor: canImport ? '#2563eb' : '#4b5563',
                    color: '#f9fafb',
                    cursor: canImport ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    opacity: canImport ? 1 : 0.6,
                  }}
                >
                  选择文件
                  <input
                    type="file"
                    accept=".txt,.md,.markdown,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    disabled={uploading || !canImport}
                  />
                </label>
                {!canImport && (
                  <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
                    您没有导入权限，请联系管理员。
                  </p>
                )}

                {file && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ marginBottom: '8px', color: '#e5e7eb' }}>
                      {file.name}（{formatFileSize(file.size)}）
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        height: '6px',
                        borderRadius: '999px',
                        backgroundColor: '#f2f2f2',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width: `${uploadProgress}%`,
                          backgroundColor: '#1677ff',
                          transition: 'width 0.2s ease-out',
                        }}
                      />
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#9ca3af' }}>
                      {uploading ? '上传中…' : uploadProgress === 100 ? '上传完成' : null}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ marginBottom: '8px', color: '#9ca3af' }}>
                  请直接粘贴小说内容，系统将自动保存为文本文件。
                </p>
                <textarea
                  id="rawNovelText"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="请输入小说内容... 例如：
第1章 开始
这是一个测试段落。"
                  style={{
                    width: '100%',
                    minHeight: '200px',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #ddd',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    resize: 'vertical',
                  }}
                />
                <button
                  onClick={handleTextUpload}
                  disabled={!rawText.trim() || uploading}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '8px 24px',
                    borderRadius: '6px',
                    backgroundColor: !rawText.trim() || uploading ? '#ccc' : '#1677ff',
                    color: '#fff',
                    border: 'none',
                    cursor: !rawText.trim() || uploading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {uploading ? '处理中...' : '确认导入文本'}
                </button>
              </div>
            )}
          </div>

          {/* 基本信息 */}
          <div
            style={{
              borderRadius: '8px',
              border: '1px solid #1f2937',
              padding: '24px',
              marginBottom: '24px',
              backgroundColor: '#020617',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>基本信息</h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                rowGap: '12px',
                columnGap: '16px',
                alignItems: 'center',
              }}
            >
              <div style={{ textAlign: 'right', color: '#9ca3af' }}>小说名</div>
              <input
                type="text"
                value={novelName}
                onChange={(e) => setNovelName(e.target.value)}
                placeholder="例如：《某某的奇妙冒险》"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                }}
              />

              <div style={{ textAlign: 'right', color: '#9ca3af' }}>作者</div>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="作者名，可选"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                }}
              />

              {/* S3-C.1: Engine 选择器 */}
              <div style={{ textAlign: 'right', color: '#9ca3af' }}>引擎</div>
              <select
                value={selectedEngineKey}
                onChange={(e) => setSelectedEngineKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                }}
              >
                {engines
                  .filter((e: any) => e.enabled !== false)
                  .map((engine: any) => (
                    <option key={engine.engineKey} value={engine.engineKey}>
                      {engine.engineKey} {engine.adapterName ? `(${engine.adapterName})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSaveMeta}
                disabled={!novelName.trim() || savingMeta}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #1677ff',
                  backgroundColor: !novelName.trim() || savingMeta ? '#1e293b' : '#0f172a',
                  color: '#e5e7eb',
                  cursor: !novelName.trim() || savingMeta ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                {savingMeta ? '保存中…' : '保存基本信息'}
              </button>

              {permissions.projectGenerate && (
                <button
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || analyzing}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: !canAnalyze || analyzing ? '#b3d4ff' : '#1677ff',
                    color: '#fff',
                    cursor: !canAnalyze || analyzing ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {analyzing ? '分析中…' : '开始分析'}
                </button>
              )}
              {!permissions.projectGenerate && (
                <p style={{ color: '#999', fontSize: '14px' }}>您没有分析权限，请联系管理员。</p>
              )}
            </div>
          </div>

          {/* S3-C.2: Recent Engine Comparison - 历史引擎差异对比 */}
          {historyJobs.length > 0 && (
            <div
              style={{
                borderRadius: '8px',
                border: '1px solid #1f2937',
                padding: '24px',
                marginBottom: '24px',
                backgroundColor: '#020617',
              }}
            >
              <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Recent Engine Comparison</h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                过去 5 条分析任务的引擎效果与成本对比
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                }}
              >
                {historyJobs.map((job) => {
                  const isHttp =
                    job.adapterName?.toLowerCase().includes('http') ||
                    job.type === 'NOVEL_ANALYSIS_HTTP';
                  const durationMs =
                    job.createdAt && job.updatedAt
                      ? new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime()
                      : null;
                  const costUsd = job.payload?.result?.metrics?.costUsd;

                  return (
                    <div
                      key={job.id}
                      style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        padding: '12px',
                        backgroundColor: '#fafafa',
                      }}
                    >
                      {/* S3-C.3: 使用统一组件展示 Engine 相关信息 */}
                      <div
                        style={{
                          marginBottom: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <EngineTag
                          engineKey={job.engineKey || '未知引擎'}
                          engineVersion={job.engineVersion}
                          size="sm"
                        />
                        {job.adapterName && (
                          <AdapterBadge adapterName={job.adapterName} size="sm" />
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <QualityScoreBadge
                          score={job.qualityScore?.score}
                          confidence={job.qualityScore?.confidence}
                          showConfidence={true}
                          size="sm"
                          variant="text"
                        />
                        {costUsd !== null && costUsd !== undefined && (
                          <div>
                            <span style={{ color: '#666' }}>成本: </span>
                            <span style={{ fontWeight: 600 }}>${costUsd.toFixed(4)}</span>
                          </div>
                        )}
                        {durationMs !== null && (
                          <div>
                            <span style={{ color: '#666' }}>耗时: </span>
                            <span style={{ fontWeight: 600 }}>
                              {durationMs < 1000
                                ? `${Math.round(durationMs)}ms`
                                : `${(durationMs / 1000).toFixed(1)}s`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Job 状态 */}
          <div
            style={{
              borderRadius: '8px',
              border: '1px solid #1f2937',
              padding: '24px',
              backgroundColor: '#020617',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '12px',
                alignItems: 'center',
              }}
            >
              <div>
                <h2 style={{ fontSize: '18px', margin: 0 }}>分析任务</h2>
                <p className="mt-2 text-xs text-gray-500">
                  提示：系统只保留当前项目最新的一条「小说分析」任务作为有效任务，旧任务会自动作废（标记为「已作废」），不会再被
                  Worker 执行。
                </p>
              </div>
              <button
                onClick={loadJobs}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                刷新状态
              </button>
            </div>

            {sortedJobs.length === 0 && (
              <div style={{ color: '#999', fontSize: '14px' }}>
                暂无相关任务。开始分析后，会在这里显示分析任务及进度。
              </div>
            )}

            {sortedJobs.length > 0 && (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      Job ID
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      类型
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      状态
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      错误/说明
                    </th>
                    {/* S3-C.1: 新增 Engine 相关列 */}
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      引擎
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      版本
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      评分
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      创建时间
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      更新时间
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '8px 4px',
                        borderBottom: '1px solid #eee',
                      }}
                    >
                      详情
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedJobs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-4 text-center text-sm text-gray-400">
                        暂无分析任务，点击「开始分析」后将自动创建任务。
                      </td>
                    </tr>
                  ) : (
                    sortedJobs.map((job) => {
                      const isLatest = job.id === latestJobId;
                      const isCancelled = job.status === 'CANCELLED';
                      const isExpanded = expandedJobId === job.id;
                      const lastError =
                        (job as any)?.lastError ||
                        (job as any)?.payload?.lastError ||
                        (job as any)?.payload?.errorMessage ||
                        null;
                      const stats = (job as any)?.payload?.result?.stats || null;
                      const metrics = (job as any)?.payload?.result?.metrics || null;
                      const rowClassName = [
                        'border-b',
                        'text-sm',
                        isLatest && !isCancelled ? 'bg-blue-50' : '',
                        isCancelled ? 'bg-gray-50 text-gray-400' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <React.Fragment key={job.id}>
                          <tr className={rowClassName}>
                            <td
                              style={{
                                padding: '6px 4px',
                                borderBottom: '1px solid #fafafa',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                              }}
                            >
                              {job.id}
                            </td>
                            <td style={{ padding: '6px 4px', borderBottom: '1px solid #fafafa' }}>
                              小说分析
                            </td>
                            <td style={{ padding: '6px 4px', borderBottom: '1px solid #fafafa' }}>
                              {isCancelled ? (
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                                  已作废
                                </span>
                              ) : (
                                job.status
                              )}
                            </td>
                            <td
                              style={{
                                padding: '6px 4px',
                                borderBottom: '1px solid #fafafa',
                                fontSize: '12px',
                                color: lastError ? '#b91c1c' : '#64748b',
                              }}
                            >
                              {lastError
                                ? String(lastError).slice(0, 80)
                                : job.status === 'RUNNING'
                                  ? '处理中…'
                                  : '-'}
                            </td>
                            {/* S3-C.1: 新增 Engine 相关列 */}
                            <td
                              style={{
                                padding: '6px 4px',
                                borderBottom: '1px solid #fafafa',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                              }}
                            >
                              {job.engineKey || '-'}
                            </td>
                            <td
                              style={{
                                padding: '6px 4px',
                                borderBottom: '1px solid #fafafa',
                                fontSize: '12px',
                                color: '#666',
                              }}
                            >
                              {job.engineVersion || '-'}
                            </td>
                            <td
                              style={{
                                padding: '6px 4px',
                                borderBottom: '1px solid #fafafa',
                                fontSize: '12px',
                              }}
                            >
                              {job.qualityScore?.score !== null &&
                              job.qualityScore?.score !== undefined ? (
                                <span
                                  style={{
                                    color:
                                      job.qualityScore.score >= 0.8
                                        ? '#4CAF50'
                                        : job.qualityScore.score >= 0.6
                                          ? '#FF9800'
                                          : '#F44336',
                                  }}
                                >
                                  {job.qualityScore.score.toFixed(2)}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td
                              style={{
                                padding: '6px 4px',
                                borderBottom: '1px solid #fafafa',
                                fontSize: '12px',
                                color: '#666',
                              }}
                            >
                              {formatDateTime(job.createdAt)}
                            </td>
                            <td
                              style={{
                                padding: '6px 4px',
                                borderBottom: '1px solid #fafafa',
                                fontSize: '12px',
                                color: '#666',
                              }}
                            >
                              {formatDateTime(job.updatedAt)}
                            </td>
                            <td style={{ padding: '6px 4px', borderBottom: '1px solid #fafafa' }}>
                              <button
                                onClick={() =>
                                  setExpandedJobId((prev) => (prev === job.id ? null : job.id))
                                }
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #334155',
                                  backgroundColor: '#0b1220',
                                  color: '#e5e7eb',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                }}
                              >
                                {isExpanded ? '收起' : '查看'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td
                                colSpan={10}
                                style={{ padding: '10px 6px', borderBottom: '1px solid #0f172a' }}
                              >
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '12px',
                                  }}
                                >
                                  <div
                                    style={{
                                      border: '1px solid #1f2937',
                                      borderRadius: '8px',
                                      padding: '10px',
                                      background: '#0b1220',
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: '12px',
                                        color: '#93c5fd',
                                        marginBottom: '6px',
                                      }}
                                    >
                                      统计 (stats)
                                    </div>
                                    <pre
                                      style={{
                                        margin: 0,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontSize: '12px',
                                        color: '#e5e7eb',
                                      }}
                                    >
                                      {stats
                                        ? JSON.stringify(stats, null, 2)
                                        : '暂无（任务未成功写回结果或仍在运行）'}
                                    </pre>
                                  </div>
                                  <div
                                    style={{
                                      border: '1px solid #1f2937',
                                      borderRadius: '8px',
                                      padding: '10px',
                                      background: '#0b1220',
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: '12px',
                                        color: '#93c5fd',
                                        marginBottom: '6px',
                                      }}
                                    >
                                      耗时/成本 (metrics)
                                    </div>
                                    <pre
                                      style={{
                                        margin: 0,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontSize: '12px',
                                        color: '#e5e7eb',
                                      }}
                                    >
                                      {metrics ? JSON.stringify(metrics, null, 2) : '暂无'}
                                    </pre>
                                    {lastError && (
                                      <>
                                        <div
                                          style={{
                                            fontSize: '12px',
                                            color: '#fca5a5',
                                            marginTop: '10px',
                                            marginBottom: '6px',
                                          }}
                                        >
                                          错误 (lastError)
                                        </div>
                                        <pre
                                          style={{
                                            margin: 0,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontSize: '12px',
                                            color: '#fecaca',
                                          }}
                                        >
                                          {String(lastError)}
                                        </pre>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* S3-C.2: 右侧栏 - Engine 质量摘要 */}
        <div style={{ width: '320px', flexShrink: 0 }}>
          <EngineSummaryPanel projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
