'use client';

import { EpisodeNode, SceneNode, ShotNode, NovelAnalysisStatus } from '@scu/shared-types';
import { PanelShell } from '@/components/ui/PanelShell';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProgressCard } from '@/components/_legacy/ui/ProgressCard';

type Level = 'season' | 'episode' | 'scene' | 'shot';

interface ContentListProps {
  selectedNode: {
    type: 'season' | 'episode' | 'scene' | 'shot';
    id: string;
    data: any;
  } | null;
  data: {
    episodes?: EpisodeNode[];
    scenes?: SceneNode[];
    shots?: ShotNode[];
  };
  onSelectNode?: (node: { type: Level; id: string; data: any }) => void;
  analysisStatus?: NovelAnalysisStatus | null; // 用于状态推断
}

/**
 * 状态推断函数（UI-only）
 * 将 NovelAnalysisStatus 映射到 StatusBadge 支持的枚举
 */
function inferStatus(
  analysisStatus: NovelAnalysisStatus | null | undefined
): 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'QUEUED' | 'CANCELLED' | 'FORCE_FAILED' {
  if (analysisStatus === 'ANALYZING') return 'RUNNING';
  if (analysisStatus === 'DONE') return 'SUCCEEDED';
  if (analysisStatus === 'FAILED') return 'FAILED';
  return 'PENDING';
}

/**
 * Shot 状态推断（UI-only）
 */
function inferShotStatus(shot: ShotNode): 'PENDING' | 'SUCCEEDED' {
  return shot.reviewedAt ? 'SUCCEEDED' : 'PENDING';
}

/**
 * 格式化相对时间（纯函数，不引入第三方库）
 */
function formatRelativeTime(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return `${diffSeconds} 秒前`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} 小时前`;
    if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)} 天前`;
    return date.toLocaleDateString('zh-CN');
  } catch {
    return null;
  }
}

/**
 * ContentList 组件
 * 根据选中节点显示列表（Command Center 风格）
 */
export default function ContentList({
  selectedNode,
  data,
  onSelectNode,
  analysisStatus,
}: ContentListProps) {
  if (!selectedNode) {
    return (
      <PanelShell empty={true}>
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          <div className="text-4xl mb-4">📂</div>
          <p className="text-sm text-gray-500 font-medium">请从左侧选择节点查看内容</p>
        </div>
      </PanelShell>
    );
  }

  // 选中 Season → 显示所有 Episode ProgressCard Grid
  if (selectedNode.type === 'season' && data.episodes) {
    const badgeStatus = inferStatus(analysisStatus);

    return (
      <PanelShell title="Episodes" description={`${data.episodes.length} 个剧集`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.episodes.map((episode: EpisodeNode) => {
            const blockers: Array<{ severity: 'warning' | 'info'; message: string }> = [];
            if (!episode.scenes || episode.scenes.length === 0) {
              blockers.push({ severity: 'warning', message: '无场景' });
            }

            return (
              <ProgressCard
                key={episode.id}
                type="episode"
                index={episode.index}
                title={episode.name}
                description={episode.summary || null}
                badgeStatus={badgeStatus}
                metrics={[{ label: 'Scenes', value: `${episode.scenes?.length || 0}` }]}
                blockers={blockers.length > 0 ? blockers : undefined}
                onClick={() => onSelectNode?.({ type: 'episode', id: episode.id, data: episode })}
              />
            );
          })}
        </div>
      </PanelShell>
    );
  }

  // 选中 Episode → 显示所有 Scene ProgressCard Grid
  if (selectedNode.type === 'episode' && data.scenes) {
    const badgeStatus = inferStatus(analysisStatus);

    return (
      <PanelShell title="Scenes" description={`${data.scenes.length} 个场景`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.scenes.map((scene: SceneNode) => {
            const blockers: Array<{ severity: 'warning' | 'info'; message: string }> = [];
            if (!scene.shots || scene.shots.length === 0) {
              blockers.push({ severity: 'warning', message: '无镜头' });
            }

            return (
              <ProgressCard
                key={scene.id}
                type="scene"
                index={scene.index}
                title={scene.title}
                description={scene.summary || null}
                badgeStatus={badgeStatus}
                metrics={[{ label: 'Shots', value: `${scene.shots?.length || 0}` }]}
                blockers={blockers.length > 0 ? blockers : undefined}
                onClick={() => onSelectNode?.({ type: 'scene', id: scene.id, data: scene })}
              />
            );
          })}
        </div>
      </PanelShell>
    );
  }

  // 选中 Scene → 显示所有 Shot 列表（增强版）
  if (selectedNode.type === 'scene' && data.shots) {
    return (
      <PanelShell title="Shots" description={`${data.shots.length} 个镜头`}>
        <div className="space-y-3">
          {data.shots.map((shot: ShotNode) => {
            const shotStatus = inferShotStatus(shot);
            const relativeTime = formatRelativeTime(shot.reviewedAt);
            const blockers: Array<{ severity: 'warning' | 'info'; message: string }> = [];
            if (!shot.reviewedAt) {
              blockers.push({ severity: 'info', message: '待审核' });
            }

            return (
              <div
                key={shot.id}
                className="border border-gray-200 rounded-xl p-4 hover:bg-orange-50 hover:border-orange-300 cursor-pointer transition-all bg-white"
                onClick={() => onSelectNode?.({ type: 'shot', id: shot.id, data: shot })}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
                      SH{shot.index.toString().padStart(2, '0')}
                    </span>
                    <StatusBadge status={shotStatus} size="sm" />
                    {shot.type && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        {shot.type}
                      </span>
                    )}
                  </div>
                </div>
                <h4 className="font-bold text-sm mb-1 text-gray-900">{shot.title || '未命名'}</h4>
                {shot.description && (
                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-2">
                    {shot.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  {/* Quality Score */}
                  {shot.qualityScore && shot.qualityScore.score !== null && (
                    <div className="text-xs text-gray-500">
                      质量评分:{' '}
                      <span className="font-medium text-gray-800">
                        {shot.qualityScore.score.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {/* Blockers & Time */}
                  <div className="flex items-center gap-2 ml-auto">
                    {blockers.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        {blockers[0].message}
                      </span>
                    )}
                    {relativeTime && <span className="text-xs text-gray-400">{relativeTime}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell empty={true}>
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="text-4xl mb-4">📄</div>
        <p className="text-sm text-gray-500 font-medium">暂无内容</p>
      </div>
    </PanelShell>
  );
}
