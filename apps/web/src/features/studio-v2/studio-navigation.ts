export interface StudioV2NavItem {
  id: string;
  label: string;
  href: string;
  phase: 'Phase 1A' | 'Phase 2' | 'Phase 3' | 'Phase 4';
  locked?: boolean;
}

export function buildStudioV2Nav(
  locale: string,
  projectId: string,
  episodeId = 'episode-placeholder'
): StudioV2NavItem[] {
  const base = `/${locale}/projects/${projectId}/studio`;

  return [
    { id: 'overview', label: '项目总览', href: base, phase: 'Phase 1A' },
    { id: 'source', label: '导入小说 / StorySource', href: `${base}/source`, phase: 'Phase 1A' },
    { id: 'story-bible', label: '故事圣经 StoryBible', href: `${base}/story-bible`, phase: 'Phase 2' },
    { id: 'episodes', label: '剧集规划 EpisodePlan', href: `${base}/episodes`, phase: 'Phase 2' },
    {
      id: 'director-script',
      label: '导演剧本 DirectorScript',
      href: `${base}/episodes/${episodeId}/director-script`,
      phase: 'Phase 3',
    },
    {
      id: 'shots',
      label: '镜头台本 ShotScript',
      href: `${base}/episodes/${episodeId}/shots`,
      phase: 'Phase 2',
    },
    {
      id: 'storyboards',
      label: '分镜图 Storyboard（锁定）',
      href: `${base}/episodes/${episodeId}/storyboards`,
      phase: 'Phase 2',
      locked: true,
    },
    {
      id: 'images',
      label: '图片生成 Image（锁定）',
      href: `${base}/episodes/${episodeId}/storyboards`,
      phase: 'Phase 2',
      locked: true,
    },
    {
      id: 'videos',
      label: '视频生成 Video（锁定）',
      href: `${base}/episodes/${episodeId}/videos`,
      phase: 'Phase 2',
      locked: true,
    },
  ];
}
