'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getOrchestratorMonitorStats } from '@/lib/apiClient';
import EngineFilter from '@/components/engines/EngineFilter';

function SchedulerMonitorPageContent() {
  const searchParams = useSearchParams();
  const selectedEngineKey = searchParams?.get('engineKey') || null;
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const result = await getOrchestratorMonitorStats();
        if (!cancelled) {
          setStats(result.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load orchestrator stats:', error);
        }
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 5000); // 每 5 秒刷新一次

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!stats) return <div className="p-6">Loading...</div>;

  // S3-C.1: 按 engineKey 过滤统计（如果指定了 engineKey）
  const enginesStats = stats.engines || {};
  const filteredEnginesStats = selectedEngineKey
    ? { [selectedEngineKey]: enginesStats[selectedEngineKey] || { pending: 0, running: 0, failed: 0 } }
    : enginesStats;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">调度统计面板</h1>
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

      {/* Job 状态统计卡片 */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="border rounded p-4">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-2xl font-bold">{stats.jobs?.pending || 0}</div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm text-gray-500">Running</div>
          <div className="text-2xl font-bold">{stats.jobs?.running || 0}</div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm text-gray-500">Retrying</div>
          <div className="text-2xl font-bold">{stats.jobs?.retrying || 0}</div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm text-gray-500">Failed</div>
          <div className="text-2xl font-bold">{stats.jobs?.failed || 0}</div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm text-gray-500">Succeeded</div>
          <div className="text-2xl font-bold">{stats.jobs?.succeeded || 0}</div>
        </div>
      </div>

      {/* 队列统计 */}
      <div className="border rounded p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">队列统计</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">平均等待时间</div>
            <div className="text-xl">
              {stats.queue?.avgWaitTimeSeconds
                ? `${stats.queue.avgWaitTimeSeconds.toFixed(1)} 秒`
                : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* 重试统计 */}
      {stats.retries?.recent24h && (
        <div className="border rounded p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">最近 24 小时重试统计</h2>
          <div className="text-sm">
            <div>总重试次数: {stats.retries.recent24h.total || 0}</div>
            {stats.retries.recent24h.byType && (
              <div className="mt-2">
                {Object.entries(stats.retries.recent24h.byType).map(([type, data]: [string, any]) => (
                  <div key={type} className="ml-4">
                    {type}: {data.count || 0} 次 (累计重试: {data.totalRetryCount || 0})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Worker 负载统计 */}
      {stats.workers && (
        <div className="border rounded p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">Worker 负载</h2>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">总数</div>
              <div className="text-xl font-bold">{stats.workers.total || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">在线</div>
              <div className="text-xl font-bold">{stats.workers.online || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">空闲</div>
              <div className="text-xl font-bold">{stats.workers.idle || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">繁忙</div>
              <div className="text-xl font-bold">{stats.workers.busy || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* 故障恢复统计 */}
      {stats.recovery?.recent1h && (
        <div className="border rounded p-4 mb-6">
          <h2 className="text-lg font-semibold mb-2">故障恢复统计</h2>
          <div className="text-sm">
            最近 1 小时恢复的 Job 数: {stats.recovery.recent1h.recoveredJobs || 0}
          </div>
        </div>
      )}

      {/* S3-C.1: 按 Engine 分组的统计 */}
      {Object.keys(filteredEnginesStats).length > 0 && (
        <div className="border rounded p-4">
          <h2 className="text-lg font-semibold mb-2">按引擎分组的 Job 状态</h2>
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(filteredEnginesStats).map(([engineKey, engineStats]: [string, any]) => (
              <div key={engineKey} className="border rounded p-3">
                <div className="font-semibold mb-2">{engineKey}</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Pending</div>
                    <div className="text-lg font-bold">{engineStats.pending || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Running</div>
                    <div className="text-lg font-bold">{engineStats.running || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Failed</div>
                    <div className="text-lg font-bold">{engineStats.failed || 0}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulerMonitorPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <SchedulerMonitorPageContent />
    </Suspense>
  );
}

