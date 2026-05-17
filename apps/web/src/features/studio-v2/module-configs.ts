import type { StudioModuleConfig } from './StudioModulePlaceholder';

export const studioModuleConfigs: Record<string, StudioModuleConfig> = {
  storyBible: {
    title: '故事圣经',
    target: '沉淀项目标题、类型、世界观、主线冲突、情感线、角色关系、视觉风格和改编策略。',
    phase: 'Phase 2',
    stageKey: 'story_bible_ready',
    legacyMapping: (state) =>
      state.legacyDataSummary.hasNovelSource ? '有旧小说来源可作为 StoryBible 输入，但尚未生成标准 StoryBible。' : '没有旧小说来源。',
    missing: '故事圣经未生成',
    futureOutput: '结构化 StoryBible',
  },
  characters: {
    title: '角色资产',
    target: '为每个角色生成独立 CharacterBible 与角色资产卡，不把人物混在一段摘要或一张图里。',
    phase: 'Phase 2',
    stageKey: 'characters_ready',
    legacyMapping: () => '本轮不把旧章节摘要伪装成角色资产。',
    missing: '角色资产未生成',
    futureOutput: 'CharacterBible、三视图提示词、表情、服饰、道具和资产绑定。',
  },
  locations: {
    title: '场景资产',
    target: '为可复用场景生成 LocationBible，包括功能定位、建筑风格、光影氛围和道具。',
    phase: 'Phase 2',
    stageKey: 'locations_ready',
    legacyMapping: () => '本轮不把旧场景文本伪装成 LocationBible。',
    missing: '场景资产未生成',
    futureOutput: 'LocationBible 与可复用场景资产。',
  },
  episodes: {
    title: '剧集规划',
    target: '把故事来源拆为剧集，明确每集标题、时长、剧情目标、情绪曲线、爽点和钩子。',
    phase: 'Phase 2',
    stageKey: 'episodes_ready',
    legacyMapping: (state) =>
      state.legacyDataSummary.episodeCount > 0
        ? `发现旧 Episode ${state.legacyDataSummary.episodeCount} 个，只作为兼容摘要。`
        : '没有旧 Episode 数据。',
    missing: '正式 EpisodePlan 未生成',
    futureOutput: 'EpisodePlan。',
  },
  directorScript: {
    title: '导演剧本',
    target: '按集生成真正的视频导演剧本，不是小说摘要。',
    phase: 'Phase 3',
    stageKey: 'director_script_ready',
    legacyMapping: () => '本轮不把旧剧情章节伪装成导演剧本。',
    missing: '导演剧本未生成',
    futureOutput: 'DirectorScript。',
  },
  shots: {
    title: '镜头台本',
    target: '按镜头生成标准 ShotScript，包含时长、景别、运镜、动作、台词、旁白、音效、光影和提示词。',
    phase: 'Phase 2',
    stageKey: 'shot_script_ready',
    legacyMapping: (state) =>
      state.legacyDataSummary.shotCount > 0
        ? `发现旧 Shot ${state.legacyDataSummary.shotCount} 个，但不能伪装成标准 ShotScript。`
        : '没有旧 Shot 数据。',
    missing: '镜头台本未生成',
    futureOutput: '标准 ShotScript。',
  },
  storyboards: {
    title: '分镜图',
    target: '建立 StoryboardAsset 文本绑定和后续分镜图边界；本切片不调用图片或视频模型。',
    phase: 'Phase 3',
    stageKey: 'storyboard_ready',
    legacyMapping: (state) =>
      state.legacyDataSummary.storyboardImageCount > 0
        ? `发现旧图片/分镜资产 ${state.legacyDataSummary.storyboardImageCount} 个，只作为兼容资产。`
        : '没有旧分镜图资产。',
    missing: 'StoryboardAsset 未生成',
    futureOutput: 'StoryboardAsset 文本绑定；图片资产留到后续独立切片。',
  },
  videos: {
    title: '视频提示词',
    target: '按镜头生成正式 VideoPrompt 文本，不创建视频任务、不调用视频模型。',
    phase: 'Phase 2',
    stageKey: 'video_prompt_ready',
    legacyMapping: (state) =>
      state.legacyDataSummary.videoJobCount > 0
        ? `发现旧 VideoJob ${state.legacyDataSummary.videoJobCount} 个，只作为兼容任务。`
        : '没有旧视频任务。',
    missing: 'VideoPrompt 未生成',
    futureOutput: 'VideoPrompt。',
  },
  review: {
    title: '审片报告',
    target: '自动评分剧情清晰度、镜头完整度、角色一致性、场景一致性、台词、音效、光影和发布风险。',
    phase: 'Phase 4',
    stageKey: 'review_required',
    legacyMapping: (state) =>
      state.legacyDataSummary.qualityScoreCount > 0
        ? `发现旧 QualityScore ${state.legacyDataSummary.qualityScoreCount} 个，但没有聚合审片报告。`
        : '没有旧质量评分。',
    missing: 'QualityReview 未生成',
    futureOutput: 'QualityReview。',
  },
  export: {
    title: '导出中心',
    target: '汇总剧本、角色、场景、分镜、视频和审片结果，生成成片导出包。',
    phase: 'Phase 4',
    stageKey: 'exported',
    legacyMapping: () => '本轮没有导出包兼容映射。',
    missing: 'ExportPackage 未生成',
    futureOutput: 'ExportPackage。',
  },
};
