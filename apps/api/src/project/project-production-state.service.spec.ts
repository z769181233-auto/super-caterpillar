import { ProjectProductionStateService } from './project-production-state.service';

function createPrismaMock(overrides: Record<string, any> = {}) {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'project-1',
        name: '测试项目',
        status: 'in_progress',
        metadata: {},
      }),
    },
    storySource: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    novelSource: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    novel: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    novelAnalysisJob: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    sceneDraft: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    episode: {
      count: jest.fn().mockResolvedValue(0),
    },
    scene: {
      count: jest.fn().mockResolvedValue(0),
    },
    shot: {
      count: jest.fn().mockResolvedValue(0),
    },
    videoJob: {
      count: jest.fn().mockResolvedValue(0),
    },
    qualityScore: {
      count: jest.fn().mockResolvedValue(0),
    },
    ...overrides,
  };
}

function readyStoryBible(overrides: Record<string, any> = {}) {
  return {
    id: 'story-bible-1',
    projectId: 'project-1',
    project_id: 'project-1',
    source_type: 'legacy_novel_source',
    status: 'ready',
    title: '表姑娘又又又又跑了',
    logline: '薛知盈在静水院藏起秘密，家族压力逼近。',
    genre: '古风剧情',
    theme: '身份秩序下的自我选择',
    tone: '克制、悬念、关系张力',
    story_world: {
      setting: '古代宅院、家族秩序与权力关系构成的连续叙事世界。',
      time_period: '架空古风',
      core_locations: [{ location_id: 'location-1', name: '静水院', description: '核心院落' }],
    },
    main_characters: [
      {
        character_id: 'character-1',
        name: '薛知盈',
        role: '主角',
        motivation: '守住秘密',
        conflict: '家族压力',
      },
      {
        character_id: 'character-2',
        name: '萧昀祈',
        role: '关键关系角色',
        motivation: '推动关系',
        conflict: '立场不明',
      },
    ],
    worldview: '古代宅院关系世界',
    mainConflict: '秘密与家族压力',
    emotionalArc: '从躲避到选择',
    characterRelationship: '薛知盈与萧昀祈被家族关系牵引',
    longTermForeshadowing: ['律法书秘密'],
    season_arc: '第一阶段围绕秘密推进',
    continuity_rules: ['不生成图片或视频'],
    visualStyle: '古风动画',
    targetPlatform: '短剧动漫',
    adaptationStrategy: '先故事圣经后镜头台本',
    audienceHook: '秘密被发现',
    sourceSummary: '薛知盈在静水院藏书。',
    sourceEvidence: ['Novel:novel-1', 'NovelSource:novel-source-1', 'chapterCount:59'],
    source_evidence: ['Novel:novel-1', 'NovelSource:novel-source-1', 'chapterCount:59'],
    quality_score: 85,
    blockers: [],
    missingReasons: [],
    generatedAt: '2026-05-23T00:00:00.000Z',
    version: 'studio-story-bible-v1',
    missingReason: null,
    ...overrides,
  };
}

function readyEpisodePlan(overrides: Record<string, any> = {}) {
  return {
    id: 'episode-plan-1',
    projectId: 'project-1',
    project_id: 'project-1',
    episodeId: 'episode-1',
    episode_id: 'episode-1',
    story_bible_id: 'story-bible-1',
    episodeNo: 1,
    episode_no: 1,
    title: '第 1 集：秘密将露',
    status: 'ready',
    durationSec: 300,
    duration_target_sec: 300,
    logline: '薛知盈在静水院藏起秘密。',
    beginning: '建立薛知盈在静水院的处境。',
    middle: '关系压力上升。',
    end: '秘密即将暴露。',
    plotGoal: '秘密与家族压力',
    emotionCurve: ['处境建立', '压力上升', '悬念收束'],
    emotional_curve: ['处境建立', '压力上升', '悬念收束'],
    key_scenes: [
      { scene_id: 's1', title: '处境建立', summary: '藏书', function: '开端', source_evidence: ['Novel:1'] },
      { scene_id: 's2', title: '压力上升', summary: '盘问', function: '推进', source_evidence: ['NovelSource:1'] },
      { scene_id: 's3', title: '钩子收束', summary: '将露', function: '钩子', source_evidence: ['ChapterEvidence:1'] },
    ],
    coolPoints: ['隐秘行动'],
    hook: '秘密即将暴露。',
    characters: ['薛知盈', '王嬷嬷'],
    locations: ['静水院'],
    appearingCharacterNames: ['薛知盈', '王嬷嬷'],
    appearingLocationNames: ['静水院'],
    productionStatus: 'ready',
    sourceEvidence: ['Novel:1', 'NovelSource:1', 'ChapterEvidence:1'],
    source_evidence: ['Novel:1', 'NovelSource:1', 'ChapterEvidence:1'],
    quality_score: 85,
    generatedAt: '2026-05-23T00:00:00.000Z',
    version: 'studio-episode-plan-v1',
    missingReason: null,
    ...overrides,
  };
}

function readyDirectorScript(overrides: Record<string, any> = {}) {
  const shotEvidence = [1, 2, 3, 4].map(
    (index) =>
      `scene-candidate:chapter-1:scene-candidate:${index} | confidence:high | sourceBlocks:${index} | location:静水院 | characters:薛知盈、王嬷嬷 | dialogueBlocks:${index} | actionBlocks:${index} | text:薛知盈说：“第 ${index} 个秘密不能暴露。”`
  );
  return {
    id: 'director-script-1',
    director_script_id: 'director-script-1',
    projectId: 'project-1',
    project_id: 'project-1',
    episodeId: 'episode-1',
    episode_id: 'episode-1',
    episodeNo: 1,
    title: '第 1 集：秘密将露',
    status: 'ready',
    logline: '导演层执行稿',
    beats: ['开场', '推进', '收束'],
    sceneBeats: ['场次 1', '场次 2', '场次 3'],
    visual_strategy: '古风宅院空间层次',
    pacing_strategy: '处境建立 -> 压力上升 -> 悬念收束',
    camera_strategy: '导演层镜头语言方向，不拆 shot_no',
    character_blocking: '薛知盈与王嬷嬷形成压迫关系',
    lighting_strategy: '柔和自然光与局部阴影',
    sound_strategy: '脚步声、翻书声和停顿',
    scene_beats: [
      { beat_id: 'b1', scene_id: 's1', dramatic_function: '开端', action: '藏书', camera_intent: '中景', source_evidence: [shotEvidence[0]] },
      { beat_id: 'b2', scene_id: 's2', dramatic_function: '推进', action: '盘问', camera_intent: '推近', source_evidence: [shotEvidence[1]] },
      { beat_id: 'b3', scene_id: 's3', dramatic_function: '钩子', action: '将露', camera_intent: '留白', source_evidence: [shotEvidence[2], shotEvidence[3]] },
    ],
    keyCharacters: ['薛知盈', '王嬷嬷'],
    keyLocations: ['静水院'],
    visualTone: '古风宅院空间层次',
    dialogueStyle: '身份差异控制台词口吻',
    soundDesign: '声音方向',
    pacingNotes: '节奏说明',
    directorNotes: ['不生成 ShotScript'],
    transition_notes: ['用环境声承接'],
    sourceEpisodePlanId: 'episode-plan-1',
    sourceEvidence: shotEvidence,
    source_evidence: shotEvidence,
    quality_score: 85,
    generatedAt: '2026-05-23T00:00:00.000Z',
    version: 'studio-director-script-v1',
    missingReason: null,
    ...overrides,
  };
}

function readyShotScript(shotNo: number, overrides: Record<string, any> = {}) {
  return {
    project_id: 'project-1',
    shot_id: `shot-script-${shotNo}`,
    episode_id: 'episode-1',
    shot_no: shotNo,
    duration_sec: 6,
    location_id: 'location-1',
    scene_id: `episode-1:scene-${Math.ceil(shotNo / 2)}`,
    characters: [
      {
        character_id: 'character-1',
        character_name: '薛知盈',
        costume_id: 'costume-1',
        expression: '警觉',
        position: '画面中景',
        action: '藏书',
        asset_ids: [],
      },
    ],
    character_id: 'character-1',
    costume_id: 'costume-1',
    expression: '警觉',
    position: '画面中景',
    action: '薛知盈藏书',
    shot_size: '中景',
    camera_movement: '缓慢推进',
    dialogue: [{ character_id: 'character-1', character_name: '薛知盈', text: '不能让书被发现。', delivery: '压低声音' }],
    voiceover: null,
    sound_design: ['脚步声'],
    lighting: '午后柔光',
    emotion: '紧张',
    visual_goal: '呈现人物压力',
    plot_function: '推动秘密暴露',
    storyboard_prompt: '分镜构图提示词，本阶段不生成图片。',
    video_prompt: '视频提示词草案，本阶段不调用视频生成。',
    continuity_notes: ['连续性备注'],
    quality_score: {
      overall: 88,
      story_clarity: 88,
      character_consistency: 88,
      location_consistency: 88,
      cinematic_quality: 88,
      publish_readiness: 88,
      needs_revision: false,
    },
    status: 'ready',
    source_director_script_id: 'director-script-1',
    source_evidence: [
      `scene-candidate:chapter-1:scene-candidate:${shotNo} | confidence:high | sourceBlocks:${shotNo} | location:静水院 | characters:薛知盈、王嬷嬷 | dialogueBlocks:${shotNo} | actionBlocks:${shotNo} | text:薛知盈说：“第 ${shotNo} 个秘密不能暴露。”`,
    ],
    generated_at: '2026-05-24T00:00:00.000Z',
    version: 'studio-shot-script-v1',
    missing_reason: null,
    ...overrides,
  };
}

function readyStoryboardAsset(shotNo: number, overrides: Record<string, any> = {}) {
  return {
    id: `storyboard-asset-${shotNo}`,
    projectId: 'project-1',
    shotId: `shot-script-${shotNo}`,
    episodeId: 'episode-1',
    shotNo,
    sceneId: `episode-1:scene-${Math.ceil(shotNo / 2)}`,
    status: 'done',
    assetKind: 'text_binding',
    assetUrl: null,
    assetStorageKey: null,
    prompt: '分镜构图提示词，本阶段不生成图片。',
    frameDescription: '文本分镜画面描述。',
    cameraLanguage: '中景 / 缓慢推进',
    characters: ['薛知盈'],
    locationId: 'location-1',
    sourceShotScriptId: `shot-script-${shotNo}`,
    sourcePrompt: '分镜构图提示词，本阶段不生成图片。',
    continuityNotes: ['连续性备注'],
    locked: true,
    generatedAt: '2026-05-25T00:00:00.000Z',
    version: 'studio-storyboard-asset-v1',
    missingReason: null,
    ...overrides,
  };
}

function readyVideoPrompt(shotNo: number, overrides: Record<string, any> = {}) {
  return {
    id: `video-prompt-${shotNo}`,
    projectId: 'project-1',
    shotId: `shot-script-${shotNo}`,
    episodeId: 'episode-1',
    shotNo,
    sceneId: `episode-1:scene-${Math.ceil(shotNo / 2)}`,
    locationId: 'location-1',
    status: 'done',
    prompt: '镜头级视频提示词，保持角色造型、服装、发型、道具和场景连续性。',
    negativePrompt: '避免角色变脸、服装错乱、手指畸形、场景跳变、字幕乱码、画面闪烁。',
    durationSec: 6,
    aspectRatio: '16:9',
    cameraLanguage: '中景 / 缓慢推进',
    characters: ['薛知盈'],
    dialogueCue: '薛知盈：不能让书被发现。',
    soundCue: '脚步声',
    lightingCue: '午后柔光',
    motionCue: '缓慢推进；薛知盈藏书',
    sourceShotScriptId: `shot-script-${shotNo}`,
    sourceStoryboardAssetId: `storyboard-asset-${shotNo}`,
    sourceStoryboardPrompt: '分镜构图提示词，本阶段不生成图片。',
    continuityNotes: ['VideoPrompt 已绑定 StoryboardAsset 文本层，但未创建 VideoJob。'],
    qualityScore: 100,
    generatedAt: '2026-05-26T00:00:00.000Z',
    version: 'studio-video-prompt-v1',
    missingReason: null,
    ...overrides,
  };
}

function readyCharacterBibles(overrides: Record<string, any>[] = []) {
  const base = [
    {
      id: 'character-bible-1',
      projectId: 'project-1',
      characterId: 'character-1',
      name: '薛知盈',
      status: 'done',
      identity: '故事核心女性角色',
      age: '原文未明确',
      personality: '谨慎、敏感，处境受限但有主动意识',
      appearance: '古风女性动画角色，发髻与衣裙细节明确',
      relationshipRole: '主角',
      profilePrompt: '薛知盈，古风女性动画角色设定卡。',
      threeViewPrompt: '薛知盈三视图。',
      expressionPrompt: '薛知盈表情展示。',
      costumePrompt: '薛知盈服饰细节。',
      hairAccessoryPrompt: '薛知盈发型头饰。',
      propPrompt: '随身书册。',
      voiceStyle: '克制、警觉',
      linkedEpisodeIds: ['episode-1'],
      linkedShotIds: ['shot-script-1'],
      assetIds: [],
      sourceEvidence: ['StoryBible:薛知盈', 'ShotScript:shot-script-1'],
      generatedAt: '2026-05-25T00:00:00.000Z',
      version: 'studio-character-bible-v1',
      missingReason: null,
    },
    {
      id: 'character-bible-2',
      projectId: 'project-1',
      characterId: 'character-2',
      name: '王嬷嬷',
      status: 'done',
      identity: '宅院长辈/管事型角色',
      age: '原文未明确',
      personality: '重规矩、强控制感',
      appearance: '古风宅院长辈角色，服饰稳重',
      relationshipRole: '压力来源',
      profilePrompt: '王嬷嬷，古风宅院长辈角色设定卡。',
      threeViewPrompt: '王嬷嬷三视图。',
      expressionPrompt: '王嬷嬷表情展示。',
      costumePrompt: '王嬷嬷服饰细节。',
      hairAccessoryPrompt: '王嬷嬷发型头饰。',
      propPrompt: '茶盏与规训道具。',
      voiceStyle: '严厉、克制',
      linkedEpisodeIds: ['episode-1'],
      linkedShotIds: ['shot-script-1'],
      assetIds: [],
      sourceEvidence: ['StoryBible:王嬷嬷', 'ShotScript:shot-script-1'],
      generatedAt: '2026-05-25T00:00:00.000Z',
      version: 'studio-character-bible-v1',
      missingReason: null,
    },
  ];
  return base.map((item, index) => ({ ...item, ...(overrides[index] || {}) }));
}

function readyLocationBibles(overrides: Record<string, any>[] = []) {
  const base = [
    {
      id: 'location-bible-1',
      projectId: 'project-1',
      locationId: 'location-1',
      name: '静水院',
      status: 'done',
      functionRole: '人物日常行动、家族秩序和关系压力发生的宅院空间',
      architectureStyle: '古风宅院建筑：木构门窗、屏风、书案、廊柱',
      lightingMood: '窗侧柔光与室内暗部对比',
      props: ['书册', '木窗'],
      reusableShotPrompts: ['静水院建立镜头', '静水院关系镜头'],
      visualPrompt: '静水院，古风宅院建筑，窗侧柔光，保持空间连续性。',
      linkedEpisodeIds: ['episode-1'],
      linkedShotIds: ['shot-script-1'],
      assetIds: [],
      sourceEvidence: ['StoryBible:静水院', 'ShotScript:shot-script-1'],
      generatedAt: '2026-05-25T00:00:00.000Z',
      version: 'studio-location-bible-v1',
      missingReason: null,
    },
  ];
  return overrides.length > base.length
    ? [
        ...base.map((item, index) => ({ ...item, ...(overrides[index] || {}) })),
        ...overrides.slice(base.length).map((override, index) => ({
          ...base[0],
          id: `location-bible-${index + base.length + 1}`,
          locationId: `location-${index + base.length + 1}`,
          name: `场景 ${index + base.length + 1}`,
          ...override,
        })),
      ]
    : base.map((item, index) => ({ ...item, ...(overrides[index] || {}) }));
}

describe('ProjectProductionStateService', () => {
  it('returns missing stages for an empty project without throwing', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.projectId).toBe('project-1');
    expect(state.currentStage).toBe('imported');
    expect(state.stages.find((stage) => stage.key === 'imported')?.status).toBe('missing');
    expect(state.stages.find((stage) => stage.key === 'story_bible_ready')?.status).toBe(
      'missing'
    );
  });

  it('does not mark story bible ready when only a legacy novel source exists', async () => {
    const prisma = createPrismaMock({
      novel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-1',
          title: '表姑娘又又又又跑了',
          author: '作者',
          fileName: 'novel.txt',
          chapterCount: 1,
          status: 'READY',
          updatedAt: new Date(),
          _count: { chapters: 1 },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.currentStage).not.toBe('story_bible_ready');
    expect(state.stages.find((stage) => stage.key === 'story_bible_ready')?.status).toBe(
      'missing'
    );
    expect(state.legacyDataSummary.hasNovelSource).toBe(true);
    expect(state.legacyDataSummary.novelChapterCount).toBe(1);
  });

  it('surfaces scene candidate coverage shortage as ProductionState risk', async () => {
    const prisma = createPrismaMock({
      novel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-1',
          title: '表姑娘又又又又跑了',
          author: '作者',
          fileName: 'novel.txt',
          chapterCount: 2,
          status: 'READY',
          updatedAt: new Date(),
          _count: { chapters: 2 },
        }),
      },
      sceneDraft: {
        findMany: jest.fn().mockResolvedValue([
          {
            analysisResult: {
              coverageReport: {
                sceneCandidateCount: 1,
                characterCount: 1,
                locationCount: 0,
                dialogueBlockCount: 1,
                actionBlockCount: 1,
                missingCapabilities: ['locations'],
                qualityGate: { status: 'blocked', score: 42 },
                sceneCandidates: [
                  {
                    id: 'scene-candidate-1',
                    summary: '薛知盈在静水院读书，被王嬷嬷催促。',
                    confidence: 'medium',
                  },
                ],
              },
            },
          },
        ]),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.legacyDataSummary.sceneCandidateCoverage).toEqual(
      expect.objectContaining({
        coverageStatus: 'insufficient',
        sceneCandidateCount: 1,
        usableSceneCandidateCount: 1,
        chapterCount: 2,
        qualityGateStatus: 'blocked',
        qualityGateScore: 42,
        missingCapabilities: ['locations'],
      })
    );
    expect(state.riskFlags.join('\n')).toContain('小说分析质量不足');
    expect(state.riskFlags.join('\n')).toContain('可用 scene candidates 不足：1/2');
    expect(state.nextActions[0]).toContain('补足章节到 scene candidate 的可追踪映射');
  });

  it('marks scene candidate coverage ready when usable candidates cover chapters', async () => {
    const prisma = createPrismaMock({
      novel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-1',
          title: '表姑娘又又又又跑了',
          author: '作者',
          fileName: 'novel.txt',
          chapterCount: 1,
          status: 'READY',
          updatedAt: new Date(),
          _count: { chapters: 1 },
        }),
      },
      sceneDraft: {
        findMany: jest.fn().mockResolvedValue([
          {
            analysisResult: {
              coverageReport: {
                qualityGate: { status: 'pass', score: 86 },
                missingCapabilities: [],
                sceneCandidates: [
                  {
                    id: 'scene-candidate-1',
                    summary: '薛知盈在静水院读书。',
                    confidence: 'high',
                  },
                ],
              },
            },
          },
        ]),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.legacyDataSummary.sceneCandidateCoverage).toEqual(
      expect.objectContaining({
        coverageStatus: 'ready',
        sceneCandidateCount: 1,
        usableSceneCandidateCount: 1,
        chapterCount: 1,
      })
    );
    expect(state.riskFlags.join('\n')).not.toContain('小说分析质量不足');
  });

  it('marks story bible ready when Studio StoryBible exists in project metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible({ id: 'project-metadata:project-1:story-bible' }),
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'story_bible_ready')?.status).toBe('done');
    expect(state.riskFlags.join('\n')).toContain('StoryBible 已生成');
  });

  it('does not mark empty Studio StoryBible metadata as ready', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: { animationStudio: { storyBible: {} } },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'story_bible_ready')?.status).toBe(
      'missing'
    );
  });

  it('blocks story bible stage when stored StoryBible fields are incomplete', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: {
                id: 'story-bible-1',
                status: 'ready',
                title: '残缺故事圣经',
                version: 'studio-story-bible-v1',
              },
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');
    const stage = state.stages.find((item) => item.key === 'story_bible_ready');

    expect(stage?.status).toBe('blocked');
    expect(stage?.missingReason).toContain('故事圣经质量门槛未通过');
    expect(state.currentStage).not.toBe('story_bible_ready');
  });

  it('marks characters ready when Studio CharacterBible records exist in project metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'characters_ready')?.status).toBe('done');
    expect(state.stages.find((stage) => stage.key === 'characters_ready')?.evidence).toContain(
      'Project.metadata.animationStudio.characterBibles:2'
    );
    expect(state.riskFlags.join('\n')).toContain('StoryBible 与 CharacterBible 已生成');
  });

  it('marks locations ready when Studio LocationBible records exist in project metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles([
                {},
                {
                  id: 'location-bible-2',
                  locationId: 'location-2',
                  name: '云墨斋',
                  visualPrompt: '云墨斋，古风书斋场景设定。',
                  sourceEvidence: ['StoryBible:云墨斋'],
                },
              ]),
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'locations_ready')?.status).toBe('done');
    expect(state.stages.find((stage) => stage.key === 'locations_ready')?.evidence).toContain(
      'Project.metadata.animationStudio.locationBibles:2'
    );
    expect(state.riskFlags.join('\n')).toContain(
      'StoryBible、CharacterBible 与 LocationBible 已生成'
    );
  });

  it('marks episodes ready only when Studio EpisodePlan records exist in project metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
            },
          },
        }),
      },
      episode: {
        count: jest.fn().mockResolvedValue(1),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'episodes_ready')?.status).toBe('done');
    expect(state.stages.find((stage) => stage.key === 'episodes_ready')?.evidence).toContain(
      'Project.metadata.animationStudio.episodePlans:1'
    );
    expect(state.riskFlags.join('\n')).toContain(
      'StoryBible、CharacterBible、LocationBible 与 EpisodePlan 已生成'
    );
  });

  it('marks director script ready only when Studio DirectorScript records exist in project metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [readyDirectorScript()],
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'director_script_ready')?.status).toBe(
      'done'
    );
    expect(state.stages.find((stage) => stage.key === 'director_script_ready')?.evidence).toContain(
      'Project.metadata.animationStudio.directorScripts:1'
    );
    expect(state.stages.find((stage) => stage.key === 'shot_script_ready')?.status).toBe(
      'missing'
    );
    expect(state.shotScriptQualityGate).toEqual(
      expect.objectContaining({
        status: 'passed',
        source: 'studio_director_scripts',
        candidateShotCount: 8,
      })
    );
    expect(state.riskFlags.join('\n')).toContain(
      'StoryBible、CharacterBible、LocationBible、EpisodePlan 与 DirectorScript 已生成'
    );
  });

  it('surfaces ShotScript quality gate blockers from DirectorScript evidence', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [
                readyDirectorScript({
                  keyLocations: ['静水院'],
                  sourceEvidence: [
                    'scene-candidate:chapter-1:scene-candidate:1 | confidence:high | sourceBlocks:1 | location:静水院 | characters:薛知盈 | dialogueBlocks:1 | actionBlocks:1 | text:薛知盈说：“不能被发现。”',
                    'scene-candidate:chapter-1:scene-candidate:2 | confidence:high | sourceBlocks:2 | location:静水院 | characters:薛知盈 | dialogueBlocks:2 | actionBlocks:2 | text:旧摘要：薛知盈藏起书页。',
                  ],
                  source_evidence: [
                    'scene-candidate:chapter-1:scene-candidate:1 | confidence:high | sourceBlocks:1 | location:静水院 | characters:薛知盈 | dialogueBlocks:1 | actionBlocks:1 | text:薛知盈说：“不能被发现。”',
                    'scene-candidate:chapter-1:scene-candidate:2 | confidence:high | sourceBlocks:2 | location:静水院 | characters:薛知盈 | dialogueBlocks:2 | actionBlocks:2 | text:旧摘要：薛知盈藏起书页。',
                  ],
                }),
              ],
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.shotScriptQualityGate).toEqual(
      expect.objectContaining({
        status: 'blocked',
        source: 'studio_director_scripts',
        candidateShotCount: 8,
        minShotCount: 8,
        dialogueExtractionRate: 1,
        characterBindingRate: 1,
        locationBindingRate: 1,
        evidenceBindingRate: 1,
        hasPlaceholderText: true,
      })
    );
    expect(state.shotScriptQualityGate.reasons).toEqual(
      expect.arrayContaining([
        '存在占位或旧摘要文本，不能作为正式镜头台本输入。',
      ])
    );
    expect(state.stages.find((stage) => stage.key === 'shot_script_ready')?.status).toBe(
      'blocked'
    );
    expect(state.stages.find((stage) => stage.key === 'shot_script_ready')?.missingReason).toContain(
      '镜头台本文本质量门槛未通过'
    );
    expect(state.riskFlags.join('\n')).toContain('镜头台本文本质量不足');
  });

  it('marks ShotScript quality gate passed before generation when DirectorScript evidence is complete', async () => {
    const sourceEvidence = [1, 2, 3, 4].map(
      (index) =>
        `scene-candidate:chapter-1:scene-candidate:${index} | confidence:high | sourceBlocks:${index} | location:静水院 | characters:薛知盈、王嬷嬷 | dialogueBlocks:${index} | actionBlocks:${index} | text:薛知盈说：“第 ${index} 个秘密不能暴露。”`
    );
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [readyDirectorScript({ keyLocations: ['静水院'], sourceEvidence, source_evidence: sourceEvidence })],
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.shotScriptQualityGate).toEqual(
      expect.objectContaining({
        status: 'passed',
        source: 'studio_director_scripts',
        candidateShotCount: 8,
        reasons: [],
      })
    );
    expect(state.stages.find((stage) => stage.key === 'shot_script_ready')?.status).toBe(
      'missing'
    );
    expect(state.riskFlags.join('\n')).not.toContain('镜头台本文本质量不足');
  });

  it('summarizes legacy episode scene and shot counts without treating them as ShotScript', async () => {
    const prisma = createPrismaMock({
      episode: {
        count: jest.fn().mockResolvedValue(2),
      },
      scene: {
        count: jest.fn().mockResolvedValue(5),
      },
      shot: {
        count: jest.fn().mockResolvedValueOnce(12).mockResolvedValueOnce(3),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.legacyDataSummary.episodeCount).toBe(2);
    expect(state.legacyDataSummary.sceneCount).toBe(5);
    expect(state.legacyDataSummary.shotCount).toBe(12);
    expect(state.legacyDataSummary.storyboardImageCount).toBe(3);
    expect(state.stages.find((stage) => stage.key === 'shot_script_ready')?.status).toBe(
      'missing'
    );
    expect(
      state.stages.find((stage) => stage.key === 'shot_script_ready')?.missingReason
    ).toContain('不能把旧摘要伪装成镜头台本');
  });

  it('marks shot script ready only when Studio ShotScript metadata exists', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [readyDirectorScript()],
              shotScripts: Array.from({ length: 8 }, (_, index) => readyShotScript(index + 1)),
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'shot_script_ready')?.status).toBe(
      'done'
    );
    expect(state.stages.find((stage) => stage.key === 'shot_script_ready')?.evidence).toContain(
      'Project.metadata.animationStudio.shotScripts:8'
    );
    expect(state.stages.find((stage) => stage.key === 'storyboard_ready')?.status).toBe(
      'missing'
    );
    expect(state.riskFlags.join('\n')).toContain(
      'ShotScript 已生成；StoryboardAsset 尚未真实生成'
    );
  });

  it('does not mark downstream text stages ready when upstream StoryBible is blocked', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible({
                status: 'ready',
                logline: null,
                source_evidence: [],
                sourceEvidence: [],
                quality_score: 20,
              }),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [readyDirectorScript()],
              shotScripts: Array.from({ length: 8 }, (_, index) => readyShotScript(index + 1)),
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'story_bible_ready')?.status).toBe(
      'blocked'
    );
    expect(state.stages.find((stage) => stage.key === 'episodes_ready')?.status).toBe(
      'blocked'
    );
    expect(state.stages.find((stage) => stage.key === 'director_script_ready')?.status).toBe(
      'blocked'
    );
    expect(state.stages.find((stage) => stage.key === 'shot_script_ready')?.status).toBe(
      'blocked'
    );
    expect(
      state.stages.find((stage) => stage.key === 'shot_script_ready')?.missingReason
    ).toContain('上游 DirectorScript / EpisodePlan / StoryBible 未通过质量门槛');
  });

  it('keeps storyboard and video prompt stages missing when ShotScript only has text prompts', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [readyDirectorScript()],
              shotScripts: Array.from({ length: 8 }, (_, index) =>
                readyShotScript(index + 1, {
                  storyboard_prompt: 'Storyboard prompt text only; 本阶段不生成图片。',
                  video_prompt: 'Video prompt text only; 本阶段不调用视频生成。',
                })
              ),
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'shot_script_ready')?.status).toBe(
      'done'
    );
    expect(state.stages.find((stage) => stage.key === 'storyboard_ready')?.status).toBe(
      'missing'
    );
    expect(state.stages.find((stage) => stage.key === 'video_prompt_ready')?.status).toBe(
      'missing'
    );
    expect(state.stages.find((stage) => stage.key === 'video_generating')?.status).toBe(
      'missing'
    );
  });

  it('marks storyboard ready only when Studio StoryboardAsset metadata exists', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [readyDirectorScript()],
              shotScripts: Array.from({ length: 8 }, (_, index) => readyShotScript(index + 1)),
              storyboardAssets: Array.from({ length: 8 }, (_, index) =>
                readyStoryboardAsset(index + 1)
              ),
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'storyboard_ready')?.status).toBe(
      'done'
    );
    expect(state.stages.find((stage) => stage.key === 'storyboard_ready')?.evidence).toContain(
      'Project.metadata.animationStudio.storyboardAssets:8'
    );
    expect(state.stages.find((stage) => stage.key === 'video_prompt_ready')?.status).toBe(
      'missing'
    );
    expect(state.riskFlags.join('\n')).toContain(
      'StoryboardAsset 文本绑定已生成；真实图片分镜仍未生成'
    );
  });

  it('summarizes Studio Storyboard image asset count separately from text bindings', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [readyDirectorScript()],
              shotScripts: Array.from({ length: 8 }, (_, index) => readyShotScript(index + 1)),
              storyboardAssets: [
                readyStoryboardAsset(1, {
                  assetKind: 'image',
                  assetUrl: '/api/storage/signed/studio/storyboards/project-1/shot-script-1.png',
                  assetStorageKey: 'studio/storyboards/project-1/shot-script-1.png',
                }),
                ...Array.from({ length: 7 }, (_, index) => readyStoryboardAsset(index + 2)),
              ],
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'storyboard_ready')?.status).toBe(
      'blocked'
    );
    expect(state.riskFlags.join('\n')).toContain(
      'StoryboardAsset 尚未真实生成'
    );
  });

  it('does not mark video prompt ready when stored VideoPrompt fails quality gate', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [readyDirectorScript()],
              shotScripts: Array.from({ length: 8 }, (_, index) => readyShotScript(index + 1)),
              storyboardAssets: Array.from({ length: 8 }, (_, index) =>
                readyStoryboardAsset(index + 1)
              ),
              videoPrompts: [
                {
                  id: 'video-prompt-1',
                  shotId: 'shot-script-1',
                  status: 'done',
                  prompt: '镜头级视频提示词',
                },
              ],
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'video_prompt_ready')?.status).toBe(
      'blocked'
    );
    expect(state.stages.find((stage) => stage.key === 'video_generating')?.status).toBe(
      'missing'
    );
  });

  it('marks video prompt ready only when Studio VideoPrompt metadata passes quality gate', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: readyStoryBible(),
              characterBibles: readyCharacterBibles(),
              locationBibles: readyLocationBibles(),
              episodePlans: [readyEpisodePlan()],
              directorScripts: [readyDirectorScript()],
              shotScripts: Array.from({ length: 8 }, (_, index) => readyShotScript(index + 1)),
              storyboardAssets: Array.from({ length: 8 }, (_, index) =>
                readyStoryboardAsset(index + 1)
              ),
              videoPrompts: Array.from({ length: 8 }, (_, index) => readyVideoPrompt(index + 1)),
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'video_prompt_ready')?.status).toBe(
      'done'
    );
    expect(state.stages.find((stage) => stage.key === 'video_prompt_ready')?.evidence).toContain(
      'Project.metadata.animationStudio.videoPrompts:8'
    );
    expect(state.stages.find((stage) => stage.key === 'video_generating')?.status).toBe(
      'missing'
    );
    expect(state.riskFlags.join('\n')).toContain(
      'StoryboardAsset 文本绑定与 VideoPrompt 已生成'
    );
  });

  it('returns read-only StorySource compatibility for legacy Novel data', async () => {
    const prisma = createPrismaMock({
      novel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'novel-1',
          title: '表姑娘又又又又跑了',
          author: '狗柱',
          fileName: 'novel.txt',
          fileSize: 1024,
          chapterCount: 59,
          status: 'READY',
          updatedAt: new Date('2026-05-09T03:16:00.000Z'),
          _count: { chapters: 59 },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const compatibility = await service.getStorySourceCompatibility('project-1', 'org-1');

    expect(compatibility.compatibilityStatus).toBe('legacy_mappable');
    expect(compatibility.canMapFromLegacy).toBe(true);
    expect(compatibility.hasCanonicalStorySource).toBe(false);
    expect(compatibility.mappingPreview.sourceTable).toBe('novels');
    expect(compatibility.mappingPreview.title).toBe('表姑娘又又又又跑了');
    expect(compatibility.mappingPreview.chapterCount).toBe(59);
    expect(compatibility.nextAction).toContain('Phase 1B 只读确认兼容映射');
  });

  it('prefers canonical StorySource when it already exists', async () => {
    const prisma = createPrismaMock({
      storySource: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue({
          id: 'source-1',
          name: '标准来源',
          path: 'story.txt',
          size: 2048,
          textHash: 'hash-1',
          createdAt: new Date('2026-05-09T03:00:00.000Z'),
          updatedAt: new Date('2026-05-09T03:10:00.000Z'),
          _count: { chunks: 3 },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const compatibility = await service.getStorySourceCompatibility('project-1', 'org-1');

    expect(compatibility.compatibilityStatus).toBe('canonical');
    expect(compatibility.canMapFromLegacy).toBe(false);
    expect(compatibility.canonicalStorySource?.chunkCount).toBe(3);
    expect(compatibility.mappingPreview.sourceTable).toBe('story_sources');
  });
});
