export interface StudioV2NavItem {
  id: string;
  label: string;
  href: string;
  phase: 'Phase 1A' | 'Phase 2' | 'Phase 3' | 'Phase 4';
  group: 'flow' | 'assets';
  locked?: boolean;
}

export function buildStudioV2Nav(
  locale: string,
  projectId: string,
  episodeId = 'episode-placeholder'
): StudioV2NavItem[] {
  const base = `/${locale}/projects/${projectId}/studio`;

  return [
    { id: 'overview', label: '开始 / 总览', href: base, phase: 'Phase 1A', group: 'flow' },
    { id: 'source', label: '1. 导入小说 / 剧本来源', href: `${base}/source`, phase: 'Phase 1A', group: 'flow' },
    { id: 'story-bible', label: '2. 故事圣经 StoryBible', href: `${base}/story-bible`, phase: 'Phase 2', group: 'flow' },
    { id: 'episodes', label: '3. 剧集规划 EpisodePlan', href: `${base}/episodes`, phase: 'Phase 2', group: 'flow' },
    {
      id: 'director-script',
      label: '4. 导演剧本 DirectorScript',
      href: `${base}/episodes/${episodeId}/director-script`,
      phase: 'Phase 3',
      group: 'flow',
    },
    {
      id: 'shots',
      label: '5. 镜头台本 ShotScript',
      href: `${base}/episodes/${episodeId}/shots`,
      phase: 'Phase 2',
      group: 'flow',
    },
    {
      id: 'storyboards',
      label: '6. 分镜图 Storyboard（锁定）',
      href: `${base}/episodes/${episodeId}/storyboards`,
      phase: 'Phase 2',
      group: 'flow',
      locked: true,
    },
    {
      id: 'images',
      label: '7. 图片生成 Image（锁定）',
      href: `${base}/episodes/${episodeId}/storyboards`,
      phase: 'Phase 2',
      group: 'flow',
      locked: true,
    },
    {
      id: 'videos',
      label: '8. 视频生成 Video（锁定）',
      href: `${base}/episodes/${episodeId}/videos`,
      phase: 'Phase 2',
      group: 'flow',
      locked: true,
    },
    { id: 'characters', label: '角色', href: `${base}/characters`, phase: 'Phase 2', group: 'assets' },
    { id: 'locations', label: '场景', href: `${base}/locations`, phase: 'Phase 2', group: 'assets' },
    { id: 'costumes', label: '服饰（待建库）', href: base, phase: 'Phase 2', group: 'assets', locked: true },
    { id: 'props', label: '道具（待建库）', href: base, phase: 'Phase 2', group: 'assets', locked: true },
  ];
}
