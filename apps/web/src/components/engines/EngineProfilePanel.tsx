'use client';

import { useEffect, useState } from 'react';
import EngineTag from '@/components/engines/EngineTag';
import AdapterBadge from '@/components/engines/AdapterBadge';
import QualityScoreBadge from '@/components/quality/QualityScoreBadge';
import type { EngineProfileSummary } from '@scu/shared-types';

interface EngineProfilePanelProps {
  engineKey?: string;
  projectId?: string;
  className?: string;
}

/**
 * S4-A: 引擎画像面板组件
 *
 * 只读展示引擎统计信息，不触发任何执行操作
 */
export default function EngineProfilePanel({
  engineKey,
  projectId,
  className = '',
}: EngineProfilePanelProps) {
  const [profiles, setProfiles] = useState<EngineProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (engineKey) {
          params.append('engineKey', engineKey);
        }
        if (projectId) {
          params.append('projectId', projectId);
        }

        const response = await fetch(`/api/engine-profile/summary?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch engine profiles: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success && result.data) {
          setProfiles(result.data.summaries || []);
        } else {
          throw new Error(result.error?.message || 'Failed to fetch engine profiles');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [engineKey, projectId]);

  if (loading) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 rounded-lg ${className}`}>
        <p className="text-red-600">错误: {error}</p>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
        <p className="text-gray-500">暂无引擎画像数据</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">引擎画像统计</h3>
        <p className="text-sm text-gray-500 mt-1">基于历史 Job 数据的引擎性能统计</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                引擎
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                任务统计
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                质量指标
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                性能指标
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {profiles.map((profile, index) => (
              <tr key={`${profile.engineKey}-${profile.engineVersion || 'null'}-${index}`}>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <EngineTag
                      engineKey={profile.engineKey}
                      engineVersion={profile.engineVersion}
                      adapterName={profile.adapterName}
                      size="sm"
                    />
                    {profile.adapterName && (
                      <AdapterBadge adapterName={profile.adapterName} size="sm" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <div className="text-gray-900 font-medium">总计: {profile.totalJobs}</div>
                    <div className="text-gray-500 text-xs mt-1">
                      成功: {profile.successCount} | 失败: {profile.failedCount}
                      {profile.retryCount > 0 && ` | 重试: ${profile.retryCount}`}
                    </div>
                    {profile.successRate !== null && (
                      <div className="text-gray-500 text-xs mt-1">
                        成功率: {(profile.successRate * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <QualityScoreBadge
                    score={profile.avgQualityScore}
                    confidence={profile.avgConfidence}
                    showConfidence={true}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600">
                    {profile.avgDurationMs !== null && (
                      <div>耗时: {(profile.avgDurationMs / 1000).toFixed(1)}s</div>
                    )}
                    {profile.avgTokens !== null && (
                      <div className="mt-1">Tokens: {profile.avgTokens.toFixed(0)}</div>
                    )}
                    {profile.avgCostUsd !== null && (
                      <div className="mt-1">成本: ${profile.avgCostUsd.toFixed(4)}</div>
                    )}
                    {profile.avgDurationMs === null &&
                      profile.avgTokens === null &&
                      profile.avgCostUsd === null && <div className="text-gray-400">-</div>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
