export interface StudioV2NavItem {
  id: string;
  label: string;
  href: string;
  phase: 'Phase 1A' | 'Phase 2' | 'Phase 3' | 'Phase 4';
}

export function buildStudioV2Nav(
  locale: string,
  projectId: string,
  episodeId = 'episode-placeholder'
): StudioV2NavItem[] {
  const base = `/${locale}/projects/${projectId}/studio`;

  return [
    { id: 'overview', label: '项目总览', href: base, phase: 'Phase 1A' },
    { id: 'source', label: '小说原文 / StorySource', href: `${base}/source`, phase: 'Phase 1A' },
    { id: 'audit', label: '只读审计', href: `${base}/audit`, phase: 'Phase 1A' },
    { id: 'story-bible', label: '故事圣经', href: `${base}/story-bible`, phase: 'Phase 2' },
    { id: 'characters', label: '角色资产', href: `${base}/characters`, phase: 'Phase 2' },
    { id: 'locations', label: '场景资产', href: `${base}/locations`, phase: 'Phase 2' },
    { id: 'episodes', label: '剧集规划', href: `${base}/episodes`, phase: 'Phase 2' },
    {
      id: 'director-script',
      label: '导演剧本',
      href: `${base}/episodes/${episodeId}/director-script`,
      phase: 'Phase 3',
    },
    {
      id: 'shots',
      label: '镜头台本',
      href: `${base}/episodes/${episodeId}/shots`,
      phase: 'Phase 2',
    },
    {
      id: 'storyboards',
      label: '分镜资产',
      href: `${base}/episodes/${episodeId}/storyboards`,
      phase: 'Phase 2',
    },
    {
      id: 'videos',
      label: '视频提示词',
      href: `${base}/episodes/${episodeId}/videos`,
      phase: 'Phase 2',
    },
    { id: 'review', label: '审片报告', href: `${base}/review`, phase: 'Phase 4' },
    { id: 'export', label: '导出中心', href: `${base}/export`, phase: 'Phase 4' },
  ];
}
