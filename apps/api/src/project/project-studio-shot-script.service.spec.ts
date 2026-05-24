import {
  ProjectStudioShotScriptService,
  validateShotScriptQuality,
} from './project-studio-shot-script.service';

function createPrismaMock(overrides: Record<string, any> = {}) {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'project-1',
        metadata: {},
      }),
      update: jest.fn().mockResolvedValue({ id: 'project-1' }),
    },
    ...overrides,
  };
}

function evidence(index: number, text?: string) {
  return [
    `scene-candidate:chapter-1:scene-candidate:${index}`,
    'confidence:high',
    `sourceBlocks:${index}`,
    index % 2 === 0 ? 'location:云墨斋' : 'location:静水院',
    'characters:薛知盈、王嬷嬷',
    `dialogueBlocks:${index}`,
    `actionBlocks:${index}`,
    `text:${text || `薛知盈说：“第 ${index} 个秘密不能暴露。”`}`,
  ].join(' | ');
}

function readyEpisodePlan(overrides: Record<string, any> = {}) {
  return {
    id: 'episode-plan-1',
    episode_id: 'episode-1',
    episodeId: 'episode-1',
    status: 'ready',
    hook: '王嬷嬷逼近，秘密即将暴露。',
    characters: ['薛知盈', '王嬷嬷'],
    locations: ['静水院', '云墨斋'],
    appearingCharacterNames: ['薛知盈', '王嬷嬷'],
    appearingLocationNames: ['静水院', '云墨斋'],
    sourceEvidence: [evidence(1), evidence(2), evidence(3), evidence(4)],
    source_evidence: [evidence(1), evidence(2), evidence(3), evidence(4)],
    quality_score: 88,
    ...overrides,
  };
}

function readyDirectorScript(overrides: Record<string, any> = {}) {
  const sourceEvidence = [evidence(1), evidence(2), evidence(3), evidence(4)];
  return {
    id: 'director-script-1',
    director_script_id: 'director-script-1',
    episode_id: 'episode-1',
    episodeId: 'episode-1',
    episodeNo: 1,
    title: '第一集：藏起律法书',
    status: 'ready',
    visual_strategy: '古风宅院空间层次',
    pacing_strategy: '处境建立 -> 压力上升 -> 悬念收束',
    camera_strategy: '导演层镜头语言方向，不拆 shot_no',
    character_blocking: '薛知盈与王嬷嬷形成压迫关系',
    lighting_strategy: '午后柔光与室内阴影形成压迫反差',
    sound_strategy: '院落风声、衣料摩擦、木门轻响',
    scene_beats: [
      { beat_id: 'b1', scene_id: 's1', dramatic_function: '开端', action: '藏书', camera_intent: '中景', source_evidence: [sourceEvidence[0]] },
      { beat_id: 'b2', scene_id: 's2', dramatic_function: '推进', action: '盘问', camera_intent: '推近', source_evidence: [sourceEvidence[1]] },
      { beat_id: 'b3', scene_id: 's3', dramatic_function: '钩子', action: '将露', camera_intent: '留白', source_evidence: [sourceEvidence[2], sourceEvidence[3]] },
    ],
    keyCharacters: ['薛知盈', '王嬷嬷'],
    keyLocations: ['静水院', '云墨斋'],
    visualTone: '古风宅院、压抑光影、细腻人物表演',
    soundDesign: '院落风声、衣料摩擦、木门轻响',
    transition_notes: ['用门外脚步声承接场次。'],
    sourceEvidence,
    source_evidence: sourceEvidence,
    quality_score: 88,
    ...overrides,
  };
}

function readyMetadata(overrides: Record<string, any> = {}) {
  return {
    animationStudio: {
      episodePlans: [readyEpisodePlan()],
      directorScripts: [readyDirectorScript()],
      characterBibles: [
        { id: 'character-1', characterId: 'char-xue', name: '薛知盈', assetIds: [], status: 'done' },
        { id: 'character-2', characterId: 'char-wang', name: '王嬷嬷', assetIds: [], status: 'done' },
      ],
      locationBibles: [
        { id: 'location-1', locationId: 'loc-jingshui', name: '静水院', lightingMood: '春日柔光与室内暗影形成压迫反差', status: 'done' },
        { id: 'location-2', locationId: 'loc-yunmo', name: '云墨斋', lightingMood: '书斋冷光与旧匣阴影形成秘密感', status: 'done' },
      ],
      ...overrides,
    },
  };
}

describe('ProjectStudioShotScriptService', () => {
  it('returns a missing ShotScript DTO when metadata has no shot scripts', async () => {
    const prisma = createPrismaMock();
    const service = new ProjectStudioShotScriptService(prisma as any);

    const shotScripts = await service.getShotScripts('project-1', 'org-1');

    expect(shotScripts).toHaveLength(1);
    expect(shotScripts[0].status).toBe('missing');
    expect(shotScripts[0].missing_reason).toBe('镜头台本未生成');
    expect(shotScripts[0].shot_id).toBe('missing');
  });

  it('returns blocked and does not write metadata when DirectorScript is missing', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: readyMetadata({ directorScripts: [] }),
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioShotScriptService(prisma as any);

    const shotScripts = await service.generateShotScripts('project-1', 'org-1');

    expect(shotScripts[0].status).toBe('blocked');
    expect(shotScripts[0].missing_reason).toContain('DirectorScript');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('returns blocked and does not write metadata when DirectorScript fields are incomplete', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: readyMetadata({
            directorScripts: [readyDirectorScript({ sourceEvidence: [], source_evidence: [], scene_beats: [] })],
          }),
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioShotScriptService(prisma as any);

    const shotScripts = await service.generateShotScripts('project-1', 'org-1');

    expect(shotScripts[0].status).toBe('blocked');
    expect(shotScripts[0].missing_reason).toContain('No stable scene candidate evidence');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('generates first-episode 8-20 ready ShotScript records from ready DirectorScript metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          metadata: readyMetadata(),
        }),
        update: jest.fn().mockResolvedValue({ id: 'project-1' }),
      },
    });
    const service = new ProjectStudioShotScriptService(prisma as any);

    const shotScripts = await service.generateShotScripts('project-1', 'org-1');

    expect(shotScripts.length).toBeGreaterThanOrEqual(8);
    expect(shotScripts.length).toBeLessThanOrEqual(20);
    for (const shot of shotScripts) {
      expect(shot.status).toBe('ready');
      expect(shot.shot_no).toBeGreaterThan(0);
      expect(shot.duration_sec).toBeGreaterThan(0);
      expect(shot.location_id || shot.scene_id).toBeTruthy();
      expect(shot.characters.length > 0 || Boolean(shot.action)).toBe(true);
      expect(shot.shot_size).toBeTruthy();
      expect(shot.camera_movement).toBeTruthy();
      expect(shot.visual_goal).toBeTruthy();
      expect(shot.plot_function).toBeTruthy();
      expect(shot.sound_design.length).toBeGreaterThan(0);
      expect(shot.lighting).toBeTruthy();
      expect(shot.emotion).toBeTruthy();
      expect(shot.storyboard_prompt).toContain('本阶段不生成图片');
      expect(shot.video_prompt).toContain('本阶段不调用视频生成');
      expect(shot.source_evidence.length).toBeGreaterThan(0);
      expect(shot.continuity_notes.length).toBeGreaterThan(0);
      expect(shot.quality_score?.overall).toBeGreaterThanOrEqual(70);
      expect([shot.action, shot.storyboard_prompt, shot.video_prompt].join('\n')).not.toMatch(
        /待编剧精修|旧摘要|未生成|待识别|待定场景/
      );
    }
    expect(shotScripts.some((shot) => shot.dialogue.length > 0 || shot.voiceover)).toBe(true);
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: {
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              shotScripts: expect.arrayContaining([
                expect.objectContaining({
                  episode_id: 'episode-1',
                  shot_no: 1,
                  status: 'ready',
                  version: 'studio-shot-script-v1',
                }),
              ]),
            }),
          }),
        },
      })
    );
    const writtenMetadata = prisma.project.update.mock.calls[0][0].data.metadata;
    expect(writtenMetadata.animationStudio.storyboardAssets).toBeUndefined();
    expect(writtenMetadata.animationStudio.videoPrompts).toBeUndefined();
    expect(writtenMetadata.animationStudio.videoJobs).toBeUndefined();
  });

  it('fails quality when source_evidence coverage is below 80%', () => {
    const shots = Array.from({ length: 8 }, (_, index) => ({
      ...readyShot(index + 1),
      source_evidence: index < 6 ? [evidence(index + 1)] : [],
    }));

    const validation = validateShotScriptQuality(shots, readyDirectorScript(), readyEpisodePlan());

    expect(validation.passed).toBe(false);
    expect(validation.evidenceCoverageRate).toBe(0.75);
    expect(validation.blockers.join('\n')).toContain('evidence_coverage_rate');
  });

  it('fails quality when continuity_notes coverage is below 80%', () => {
    const shots = Array.from({ length: 8 }, (_, index) => ({
      ...readyShot(index + 1),
      continuity_notes: index < 6 ? ['连续性备注'] : [],
    }));

    const validation = validateShotScriptQuality(shots, readyDirectorScript(), readyEpisodePlan());

    expect(validation.passed).toBe(false);
    expect(validation.continuityCoverageRate).toBe(0.75);
    expect(validation.blockers.join('\n')).toContain('continuity_coverage_rate');
  });

  it('fails quality when overall quality_score is below 70', () => {
    const shots = Array.from({ length: 8 }, (_, index) => ({
      ...readyShot(index + 1),
      quality_score: {
        overall: 60,
        story_clarity: 60,
        character_consistency: 60,
        location_consistency: 60,
        cinematic_quality: 60,
        publish_readiness: 60,
        needs_revision: true,
      },
    }));

    const validation = validateShotScriptQuality(shots, readyDirectorScript(), readyEpisodePlan());

    expect(validation.passed).toBe(false);
    expect(validation.blockers.join('\n')).toContain('overall_quality_score 60/70');
  });
});

function readyShot(shotNo: number) {
  return {
    project_id: 'project-1',
    shot_id: `shot-${shotNo}`,
    episode_id: 'episode-1',
    shot_no: shotNo,
    duration_sec: 6,
    location_id: 'loc-jingshui',
    scene_id: `episode-1:scene-${Math.ceil(shotNo / 2)}`,
    characters: [
      {
        character_id: 'char-xue',
        character_name: '薛知盈',
        costume_id: 'costume-1',
        expression: '警觉',
        position: '画面中景',
        action: '藏书',
        asset_ids: [],
      },
    ],
    character_id: 'char-xue',
    costume_id: 'costume-1',
    expression: '警觉',
    position: '画面中景',
    action: '薛知盈藏书',
    shot_size: '中景',
    camera_movement: '缓慢推进',
    dialogue: [{ character_id: 'char-xue', character_name: '薛知盈', text: '不能让书被发现。', delivery: '压低声音' }],
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
    status: 'ready' as const,
    blockers: [],
    missingReasons: [],
    source_director_script_id: 'director-script-1',
    source_evidence: [evidence(shotNo)],
    generated_at: '2026-05-24T00:00:00.000Z',
    version: 'studio-shot-script-v1',
    missing_reason: null,
  };
}
