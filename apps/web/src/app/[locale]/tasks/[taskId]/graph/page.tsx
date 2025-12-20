'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getTaskGraph } from '@/lib/apiClient';
import EngineFilter from '@/components/engines/EngineFilter';
import EngineTag from '@/components/engines/EngineTag';
import AdapterBadge from '@/components/engines/AdapterBadge';
import QualityScoreBadge from '@/components/quality/QualityScoreBadge';

function TaskGraphPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const taskId = params.taskId as string;
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;

    const loadGraph = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getTaskGraph(taskId);
        if (!cancelled) {
          if (result.success) {
            setGraph(result.data);
          } else {
            setError(result.error?.message || '获取任务关系图失败');
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || '获取任务关系图失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const selectedEngineKey = searchParams?.get('engineKey') || null;

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!graph) return <div className="p-6">Task not found</div>;

  // 计算每个 Job 的耗时
  const calculateDuration = (job: any) => {
    if (!job.startedAt) return null;
    const start = new Date(job.startedAt).getTime();
    const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now();
    return Math.round((end - start) / 1000); // 秒
  };

  // S3-C.1: 按 engineKey 过滤 jobs（如果指定了筛选）
  const filteredJobs = selectedEngineKey
    ? graph.jobs?.filter((job: any) => job.engineKey === selectedEngineKey) || []
    : graph.jobs || [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">任务关系图</h1>
        {/* S3-C.1: Engine 筛选器 */}
        <div className="flex items-center gap-2">
          <label className="text-sm">引擎筛选:</label>
          <EngineFilter
            queryParam="engineKey"
            showAll={true}
            defaultValue={null}
            className="p-2 border border-gray-300 rounded text-sm"
          />
        </div>
      </div>

      {/* Task 基本信息 */}
      <div className="border rounded p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Task 信息</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Task ID:</span> {graph.taskId}
          </div>
          <div>
            <span className="text-gray-500">Project ID:</span> {graph.projectId}
          </div>
          <div>
            <span className="text-gray-500">Task Type:</span> {graph.taskType}
          </div>
          <div>
            <span className="text-gray-500">Status:</span>{' '}
            <span className="font-semibold">{graph.status}</span>
          </div>
        </div>
      </div>

      {/* Job 列表 */}
      <div className="border rounded p-4">
        <h2 className="text-lg font-semibold mb-4">
          关联的 Jobs ({filteredJobs.length} / {graph.jobs?.length || 0})
        </h2>
        {filteredJobs && filteredJobs.length > 0 ? (
          <table className="min-w-full border-collapse border">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-2 text-left">Job ID</th>
                <th className="border p-2 text-left">Job Type</th>
                <th className="border p-2 text-left">Status</th>
                {/* S3-C.1: 新增 Engine 相关列 */}
                <th className="border p-2 text-left">引擎</th>
                <th className="border p-2 text-left">版本</th>
                <th className="border p-2 text-left">适配器</th>
                <th className="border p-2 text-left">质量评分</th>
                <th className="border p-2 text-left">Attempts</th>
                <th className="border p-2 text-left">Retry Count</th>
                <th className="border p-2 text-left">Max Retry</th>
                <th className="border p-2 text-left">Duration (s)</th>
                <th className="border p-2 text-left">Created At</th>
                <th className="border p-2 text-left">Finished At</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job: any) => {
                const duration = calculateDuration(job);
                // S3-C.1: 查找对应的 qualityScore
                const qualityScore = graph.qualityScores?.find((qs: any) => qs.jobId === job.jobId);
                return (
                  <tr key={job.jobId}>
                    <td className="border p-2 font-mono text-xs">{job.jobId}</td>
                    <td className="border p-2">{job.jobType}</td>
                    <td className="border p-2">
                      <div className="flex flex-col gap-1">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          job.status === 'SUCCEEDED'
                            ? 'bg-green-100 text-green-800'
                            : job.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : job.status === 'RUNNING'
                            ? 'bg-blue-100 text-blue-800'
                            : job.status === 'RETRYING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {job.status}
                      </span>
                        {/* S3-C.3: 使用统一组件展示 Engine 相关信息 */}
                        {job.engineKey && (
                          <EngineTag
                            engineKey={job.engineKey}
                            engineVersion={job.engineVersion}
                            size="sm"
                          />
                        )}
                        {job.adapterName && (
                          <AdapterBadge adapterName={job.adapterName} size="sm" />
                        )}
                        <QualityScoreBadge
                          score={qualityScore?.quality?.score}
                          confidence={qualityScore?.quality?.confidence}
                          showConfidence={false}
                          size="sm"
                          variant="badge"
                        />
                      </div>
                    </td>
                    {/* S3-C.3: 使用统一组件展示 Engine 相关信息 */}
                    <td className="border p-2">
                      <EngineTag
                        engineKey={job.engineKey || 'default_novel_analysis'}
                        engineVersion={job.engineVersion}
                        size="sm"
                      />
                    </td>
                    <td className="border p-2 text-xs">{job.engineVersion || '-'}</td>
                    <td className="border p-2">
                      {job.adapterName ? (
                        <AdapterBadge adapterName={job.adapterName} size="sm" />
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border p-2">
                      <QualityScoreBadge
                        score={qualityScore?.quality?.score}
                        confidence={qualityScore?.quality?.confidence}
                        showConfidence={true}
                        size="sm"
                        variant="text"
                      />
                    </td>
                    <td className="border p-2">{job.attempts}</td>
                    <td className="border p-2">{job.retryCount}</td>
                    <td className="border p-2">{job.maxRetry ?? 'N/A'}</td>
                    <td className="border p-2">{duration !== null ? `${duration}s` : 'N/A'}</td>
                    <td className="border p-2 text-xs">
                      {job.createdAt ? new Date(job.createdAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="border p-2 text-xs">
                      {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-gray-500">暂无关联的 Jobs</div>
        )}
      </div>
    </div>
  );
}

export default function TaskGraphPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <TaskGraphPageContent />
    </Suspense>
  );
}

