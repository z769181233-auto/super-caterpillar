// apps/web/src/components/project/ProjectStructureTree.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { projectApi } from '@/lib/apiClient';

import {
  ProjectStructureTree as ProjectStructureTreeDTO,
  ProjectStructureSeasonNode,
  ProjectStructureEpisodeNode,
  ProjectStructureSceneNode,
  ProjectStructureShotNode
} from '@scu/shared-types';

interface ProjectStructureTreeProps {
  projectId: string;
  data?: ProjectStructureTreeDTO | null; // S3-C: Single Source of Truth
}

export default function ProjectStructureTree({ projectId, data }: ProjectStructureTreeProps) {
  const [internalStructure, setInternalStructure] = useState<ProjectStructureTreeDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inflightRef = useRef(false);
  const pollMsRef = useRef(8000); // 8s -> 60s backoff

  // Use provided data or authentic internal data
  const structure = data ?? internalStructure;

  // S3-D Fine-Tune: 加载结构树 (Only if data not provided)
  const loadStructure = React.useCallback(async () => {
    if (data) return; // Managed mode: do not fetch
    try {
      setLoading(true);
      setError(null);
      const res = await projectApi.getProjectStructure(projectId);
      setInternalStructure(res);
      // Auto-expand logic handled by parent or here?
      // For now, simple auto-expand logic if internal
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载项目结构失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId, data]);

  // Initial load
  useEffect(() => {
    if (!data) loadStructure();
    else setLoading(false);
  }, [loadStructure, data]);

  // S3-D Fine-Tune: Polling management (Robust)
  useEffect(() => {
    const stop = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const start = () => {
      stop();
      if (!structure || structure.statusSummary?.analysis === 'DONE') return;

      pollingIntervalRef.current = setInterval(async () => {
        // hidden 时不跑（但 interval 仍在，这里只做兜底；真正暂停靠 visibilitychange）
        if (typeof document !== 'undefined' && document.hidden) return;
        if (inflightRef.current) return;

        inflightRef.current = true;
        try {
          const res = await projectApi.getProjectStructure(projectId);
          setInternalStructure(res);
          // 成功：恢复常规轮询
          pollMsRef.current = 8000;
        } catch (err: unknown) {
          // 429 退避：最多到 60s
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('429') || msg.includes('Too Many Requests')) {
            pollMsRef.current = Math.min(pollMsRef.current * 2, 60000);
            // 退避后重建 interval（立即生效）
            start();
          } else {
            console.error('Polling failed:', err);
          }
        } finally {
          inflightRef.current = false;
        }
      }, pollMsRef.current);
    };

    const onVis = () => {
      if (typeof document !== 'undefined' && document.hidden) stop();
      else start();
    };

    // 初始化：按当前可见性决定是否启动
    if (typeof document !== 'undefined' && document.hidden) stop();
    else start();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, structure?.statusSummary?.analysis]);


  // S3-D Fine-Tune: 切换节点展开/收起
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // S3-C Hard Revision 2: Title/Name 字段兼容 (避免旧数据/legacy字段导致的显示问题)
  const getNodeTitle = (node: any): string => {
    return node.title ?? node.name ?? '(untitled)';
  };

  // S3-D Fine-Tune: 统一状态图标风格
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { label: string; className: string; icon: string }> = {
      PENDING: { label: '待解析', className: 'bg-gray-100 text-gray-700', icon: '⏳' },
      ANALYZING: { label: '解析中', className: 'bg-blue-100 text-blue-700', icon: '🔄' },
      DONE: { label: '已完成', className: 'bg-green-100 text-green-700', icon: '✅' },
      FAILED: { label: '失败', className: 'bg-red-100 text-red-700', icon: '❌' },
    };
    const statusInfo = statusMap[status] || statusMap.PENDING;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusInfo.className}`}>
        <span>{statusInfo.icon}</span>
        <span>{statusInfo.label}</span>
      </span>
    );
  };

  // Industrial Status Badge
  const getIndustrialStatusBadge = (qaStatus?: string, blockingReason?: string | null) => {
    if (!qaStatus) return null;
    const map: Record<string, { class: string, icon: string }> = {
      PASS: { class: 'bg-green-100 text-green-800 border-green-200', icon: '✅' },
      WARN: { class: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⚠️' },
      FAIL: { class: 'bg-red-100 text-red-800 border-red-200', icon: '🚫' },
      PENDING: { class: 'bg-gray-100 text-gray-500 border-gray-200', icon: '⏳' }
    };
    const style = map[qaStatus] || map.PENDING;

    return (
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 ${style.class}`}>
          {style.icon} {qaStatus}
        </span>
        {blockingReason && (
          <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 max-w-[200px] truncate" title={blockingReason}>
            🔒 {blockingReason}
          </span>
        )}
      </div>
    );
  };

  // S3-D Fine-Tune: 加载动画（Skeleton）
  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>{error}</p>
        <button
          onClick={loadStructure}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    );
  }

  if (!structure) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>数据加载中...</p>
      </div>
    );
  }

  if (structure.tree.length === 0) {
    if (structure.statusSummary?.analysis === 'ANALYZING' || structure.statusSummary?.analysis === 'PENDING') {
      return (
        <div className="p-6 flex flex-col items-center justify-center text-center space-y-4 bg-blue-50/50 m-4 rounded-xl border border-blue-100">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-ping opacity-25"></div>
            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-800">AI 正在构建世界观...</h3>
            <p className="text-xs text-blue-600 mt-1">分析完成后，剧集结构将在此处生成</p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        <p>暂无项目结构</p>
        <p className="mt-1 text-xs">请点击上方“导入小说”开始</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* 顶部：分析状态 */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">项目结构</h3>
        {getStatusTag(structure.statusSummary?.analysis ?? 'PENDING')}
      </div>

      <div className="mb-4 text-sm text-gray-600">
        <span>季: {structure.counts.seasons}</span>
        <span className="ml-4">集: {structure.counts.episodes}</span>
        <span className="ml-4">场景: {structure.counts.scenes}</span>
        <span className="ml-4">镜头: {structure.counts.shots}</span>
      </div>

      {/* 结构树 */}
      <div className="space-y-2">
        {structure.tree.map((season: ProjectStructureSeasonNode) => (
          <div key={season.id} className="border rounded p-2">
            {/* Season 节点 */}
            <div
              className="flex items-center cursor-pointer hover:bg-blue-50 rounded px-2 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              onClick={() => toggleNode(season.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleNode(season.id);
                }
              }}
            >
              <span className="mr-2 text-gray-400 text-sm">
                {expandedNodes.has(season.id) ? '▼' : '▶'}
              </span>
              <span className="font-semibold text-gray-900">
                S{season.index} - {getNodeTitle(season)}
              </span>
            </div>

            {/* Episode 列表 */}
            {expandedNodes.has(season.id) && (
              <div className="ml-6 mt-2 space-y-2">
                {season.episodes.map((episode: ProjectStructureEpisodeNode) => (
                  <div key={episode.id} className="border-l-2 border-gray-200 pl-2">
                    {/* Episode 节点 */}
                    <div
                      className="flex items-center cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                      onClick={() => toggleNode(episode.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleNode(episode.id);
                        }
                      }}
                    >
                      <span className="mr-2 text-gray-400 text-xs">
                        {expandedNodes.has(episode.id) ? '▼' : '▶'}
                      </span>
                      <span className="text-sm font-medium text-gray-800">
                        E{episode.index} - {getNodeTitle(episode)}
                      </span>
                    </div>

                    {/* Scene 列表 */}
                    {expandedNodes.has(episode.id) && (
                      <div className="ml-6 mt-2 space-y-1">
                        {episode.scenes.map((scene: ProjectStructureSceneNode) => (
                          <div key={scene.id} className="border-l-2 border-gray-200 pl-2">
                            {/* Scene 节点 */}
                            <div
                              className="flex items-center justify-between hover:bg-blue-50 rounded px-2 py-1 transition-colors"
                            >
                              <div
                                className="flex items-center cursor-pointer focus:outline-none"
                                onClick={() => toggleNode(scene.id)}
                                role="button"
                                tabIndex={0}
                              >
                                <span className="mr-2 text-gray-400 text-xs">
                                  {expandedNodes.has(scene.id) ? '▼' : '▶'}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-700">
                                    SC{scene.index} - {getNodeTitle(scene)}
                                  </span>
                                  {scene.visualDensityScore !== undefined && scene.visualDensityScore !== null && (
                                    <span className="text-[10px] px-1 py-0.5 bg-purple-100 text-purple-700 rounded" title="Visual Density">
                                      VD:{scene.visualDensityScore.toFixed(1)}
                                    </span>
                                  )}
                                  {scene.enrichedText && (
                                    <span className="text-xs" title="Enriched">✨</span>
                                  )}
                                </div>
                              </div>
                              {/* Industrial Status for Scene */}
                              {getIndustrialStatusBadge(scene.qaStatus, scene.blockingReason)}
                            </div>

                            {/* Shot 列表 */}
                            {expandedNodes.has(scene.id) && (
                              <div className="ml-6 mt-1 space-y-0.5">
                                {scene.shots.map((shot: ProjectStructureShotNode) => (
                                  <div
                                    key={shot.id}
                                    className="flex items-center justify-between text-xs text-gray-600 hover:bg-gray-50 px-2 py-1.5 rounded cursor-pointer transition-colors"
                                  >
                                    <div className="hover:text-gray-900">
                                      SH{shot.index} - {getNodeTitle(shot)}
                                    </div>
                                    {/* Industrial Status for Shot */}
                                    {getIndustrialStatusBadge(shot.qaStatus, shot.blockingReason)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
