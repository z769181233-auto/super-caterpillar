'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { extendedJobApi } from '@/lib/apiClient';

interface EngineSummary {
  engineKey: string;
  totalJobs: number;
  avgScore: number | null;
  avgConfidence: number | null;
  successRate: number;
  avgDurationMs: number | null;
  avgCostUsd: number | null;
}

interface EngineSummaryPanelProps {
  /**
   * 项目 ID（可选）
   */
  projectId?: string;
  /**
   * 自定义样式类名
   */
  className?: string;
  /**
   * 是否显示标题
   */
  showTitle?: boolean;
}

/**
 * S3-C.2: Engine 质量摘要面板组件
 *
 * 功能：
 * - 从 URL Query 读取 engineKey
 * - 调用 /api/jobs/engine-summary 获取聚合数据
 * - 展示 avgScore, avgConfidence, successRate, avgDurationMs, avgCostUsd
 */
export default function EngineSummaryPanel({
  projectId,
  className = '',
  showTitle = true,
}: EngineSummaryPanelProps) {
  const searchParams = useSearchParams();
  const engineKey = searchParams?.get('engineKey');
  const [summary, setSummary] = useState<EngineSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!engineKey) {
      setSummary(null);
      return;
    }

    async function loadSummary() {
      try {
        setLoading(true);
        setError(null);
        const data = await extendedJobApi.getEngineSummary(engineKey, projectId);
        setSummary(data);
      } catch (err: unknown) {
        console.error('Failed to load engine summary:', err);
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [engineKey, projectId]);

  if (!engineKey) {
    return (
      <div className={`border rounded p-4 bg-gray-50 ${className}`}>
        {showTitle && <h3 className="text-sm font-semibold mb-2">引擎质量摘要</h3>}
        <p className="text-sm text-gray-500">请选择引擎以查看质量摘要</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`border rounded p-4 bg-white ${className}`}>
        {showTitle && <h3 className="text-sm font-semibold mb-2">引擎质量摘要</h3>}
        <p className="text-sm text-gray-500">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`border rounded p-4 bg-red-50 ${className}`}>
        {showTitle && <h3 className="text-sm font-semibold mb-2">引擎质量摘要</h3>}
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!summary || summary.totalJobs === 0) {
    return (
      <div className={`border rounded p-4 bg-white ${className}`}>
        {showTitle && <h3 className="text-sm font-semibold mb-2">引擎质量摘要</h3>}
        <p className="text-sm text-gray-500">暂无数据</p>
      </div>
    );
  }

  return (
    <div className={`border rounded p-4 bg-white ${className}`}>
      {showTitle && (
        <h3 className="text-sm font-semibold mb-3">
          引擎质量摘要: <span className="font-mono text-xs">{summary.engineKey}</span>
        </h3>
      )}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-gray-500 text-xs">总任务数</div>
          <div className="text-lg font-semibold">{summary.totalJobs}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">成功率</div>
          <div
            className="text-lg font-semibold"
            style={{
              color:
                summary.successRate >= 0.9
                  ? '#4CAF50'
                  : summary.successRate >= 0.7
                    ? '#FF9800'
                    : '#F44336',
            }}
          >
            {(summary.successRate * 100).toFixed(1)}%
          </div>
        </div>
        {summary.avgScore !== null && (
          <div>
            <div className="text-gray-500 text-xs">平均评分</div>
            <div
              className="text-lg font-semibold"
              style={{
                color:
                  summary.avgScore >= 0.8
                    ? '#4CAF50'
                    : summary.avgScore >= 0.6
                      ? '#FF9800'
                      : '#F44336',
              }}
            >
              {summary.avgScore.toFixed(2)}
            </div>
          </div>
        )}
        {summary.avgConfidence !== null && (
          <div>
            <div className="text-gray-500 text-xs">平均置信度</div>
            <div className="text-lg font-semibold">{summary.avgConfidence.toFixed(2)}</div>
          </div>
        )}
        {summary.avgDurationMs !== null && (
          <div>
            <div className="text-gray-500 text-xs">平均耗时</div>
            <div className="text-lg font-semibold">
              {summary.avgDurationMs < 1000
                ? `${Math.round(summary.avgDurationMs)}ms`
                : `${(summary.avgDurationMs / 1000).toFixed(1)}s`}
            </div>
          </div>
        )}
        {summary.avgCostUsd !== null && (
          <div>
            <div className="text-gray-500 text-xs">平均成本</div>
            <div className="text-lg font-semibold">${summary.avgCostUsd.toFixed(4)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
