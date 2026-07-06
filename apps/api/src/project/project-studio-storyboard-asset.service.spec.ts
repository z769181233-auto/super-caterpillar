import {
  ProjectStudioStoryboardAssetService,
  validateStoryboardAssetQuality,
} from './project-studio-storyboard-asset.service';

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
    dialogue: [{ character_id: 'character-1', character_name: '薛知盈', text: '不能让书被发现。' }],
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
    source_evidence: [`source evidence ${shotNo}`],
    generated_at: '2026-05-24T00:00:00.000Z',
    version: 'studio-shot-script-v1',
    missing_reason: null,
    ...overrides,
  };
}

function readyShotScripts() {
  return Array.from({ length: 8 }, (_, index) => readyShotScript(index + 1));
}

function readyStoryboardAssets() {
  return readyShotScripts().map((shot) => ({
    id: `storyboard-asset-${shot.shot_no}`,
    projectId: 'project-1',
    shotId: shot.shot_id,
    episodeId: shot.episode_id,
    shotNo: shot.shot_no,
    sceneId: shot.scene_id,
    status: 'done',
    assetKind: 'text_binding',
    assetUrl: null,
    assetStorageKey: null,
    prompt: shot.storyboard_prompt,
    frameDescription: shot.visual_goal,
    cameraLanguage: `${shot.shot_size} / ${shot.camera_movement}`,
    characters: ['薛知盈'],
    locationId: 'location-1',
    sourceShotScriptId: shot.shot_id,
    sourcePrompt: shot.storyboard_prompt,
    continuityNotes: ['连续性备注'],
    locked: true,
    generatedAt: '2026-05-25T00:00:00.000Z',
    version: 'studio-storyboard-asset-v1',
    missingReason: null,
  }));
}

function readyVideoPrompts() {
  return readyShotScripts().map((shot) => ({
    id: `video-prompt-${shot.shot_no}`,
    projectId: 'project-1',
    shotId: shot.shot_id,
    episodeId: shot.episode_id,
    shotNo: shot.shot_no,
    sceneId: shot.scene_id,
    locationId: shot.location_id,
    status: 'done',
    prompt: '镜头级视频提示词，保持角色造型、服装、发型、道具和场景连续性。',
    negativePrompt: '避免角色变脸、服装错乱、手指畸形、场景跳变、字幕乱码、画面闪烁。',
    durationSec: shot.duration_sec,
    aspectRatio: '16:9',
    cameraLanguage: `${shot.shot_size} / ${shot.camera_movement}`,
    characters: ['薛知盈'],
    dialogueCue: '薛知盈：不能让书被发现。',
    soundCue: '脚步声',
    lightingCue: '午后柔光',
    motionCue: '缓慢推进；薛知盈藏书',
    sourceShotScriptId: shot.shot_id,
    sourceStoryboardAssetId: `storyboard-asset-${shot.shot_no}`,
    sourceStoryboardPrompt: shot.storyboard_prompt,
    continuityNotes: ['VideoPrompt 已绑定 StoryboardAsset 文本层，但未创建 VideoJob。'],
    qualityScore: 100,
    generatedAt: '2026-05-26T00:00:00.000Z',
    version: 'studio-video-prompt-v1',
    missingReason: null,
  }));
}

function readyCharacterBibles() {
  return [
    {
      id: 'character-bible-1',
      projectId: 'project-1',
      characterId: 'character-1',
      name: '薛知盈',
      status: 'done',
      identity: '故事核心女性角色',
      personality: '谨慎、敏感',
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
      identity: '宅院管事角色',
      personality: '重规矩',
      appearance: '古风宅院长辈角色，服饰稳重',
      relationshipRole: '压力来源',
      profilePrompt: '王嬷嬷，古风宅院长辈角色设定卡。',
      threeViewPrompt: '王嬷嬷三视图。',
      expressionPrompt: '王嬷嬷表情展示。',
      costumePrompt: '王嬷嬷服饰细节。',
      hairAccessoryPrompt: '王嬷嬷发型头饰。',
      propPrompt: '茶盏。',
      voiceStyle: '严厉',
      linkedEpisodeIds: ['episode-1'],
      linkedShotIds: ['shot-script-1'],
      assetIds: [],
      sourceEvidence: ['StoryBible:王嬷嬷', 'ShotScript:shot-script-1'],
      generatedAt: '2026-05-25T00:00:00.000Z',
      version: 'studio-character-bible-v1',
      missingReason: null,
    },
  ];
}

function readyLocationBibles() {
  return [
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
      reusableShotPrompts: ['静水院建立镜头'],
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
}

function createPrismaMock(metadata: Record<string, any>) {
  return {
    project: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'project-1',
        metadata,
      }),
      update: jest.fn().mockResolvedValue({ id: 'project-1' }),
    },
  };
}

describe('ProjectStudioStoryboardAssetService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STUDIO_STORYBOARD_IMAGE_PROVIDER;
    delete process.env.ENABLE_STUDIO_REAL_IMAGE_GENERATION;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns missing StoryboardAsset state without throwing', async () => {
    const prisma = createPrismaMock({ animationStudio: {} });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const assets = await service.getStoryboardAssets('project-1', 'org-1');

    expect(assets).toHaveLength(1);
    expect(assets[0]).toEqual(
      expect.objectContaining({
        status: 'missing',
        assetKind: 'text_binding',
        assetUrl: null,
        locked: true,
      })
    );
  });

  it('blocks generation when ready ShotScript is missing and does not write metadata', async () => {
    const prisma = createPrismaMock({ animationStudio: {} });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const assets = await service.generateStoryboardAssets('project-1', 'org-1');

    expect(assets[0].status).toBe('blocked');
    expect(assets[0].missingReason).toContain('缺少 ready ShotScript');
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('generates one locked text binding StoryboardAsset for each ready ShotScript', async () => {
    const shotScripts = readyShotScripts();
    const prisma = createPrismaMock({
      animationStudio: {
        shotScripts,
        directorScripts: [{ status: 'ready' }],
        episodePlans: [{ status: 'ready' }],
      },
    });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const assets = await service.generateStoryboardAssets('project-1', 'org-1');

    expect(assets).toHaveLength(8);
    expect(assets[0]).toEqual(
      expect.objectContaining({
        status: 'done',
        assetKind: 'text_binding',
        assetUrl: null,
        assetStorageKey: null,
        locked: true,
        sourceShotScriptId: 'shot-script-1',
      })
    );
    expect(assets.every((asset) => asset.prompt?.includes('不生成图片'))).toBe(true);
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              storyboardAssets: assets,
            }),
          }),
        }),
      })
    );
  });

  it('blocks storyboard quality when image fields are present', () => {
    const shotScripts = readyShotScripts();
    const assets = shotScripts.map((shot) => ({
      id: `asset-${shot.shot_no}`,
      projectId: 'project-1',
      shotId: shot.shot_id,
      sourceShotScriptId: shot.shot_id,
      status: 'done',
      assetKind: 'text_binding',
      prompt: shot.storyboard_prompt,
      frameDescription: shot.visual_goal,
      cameraLanguage: `${shot.shot_size} / ${shot.camera_movement}`,
      continuityNotes: ['连续性备注'],
      locked: true,
      assetUrl: null,
      assetStorageKey: null,
    }));

    const result = validateStoryboardAssetQuality(
      [{ ...assets[0], assetKind: 'image', assetUrl: 'https://example.test/image.png' }, ...assets.slice(1)],
      shotScripts
    );

    expect(result.passed).toBe(false);
    expect(result.blockers.join('\n')).toContain('不允许生成图片资产');
  });

  it('returns storyboard image readiness without writing image metadata or jobs', async () => {
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets: readyStoryboardAssets(),
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const readiness = await service.getStoryboardImageReadiness('project-1', 'org-1');

    expect(readiness.status).toBe('ready');
    expect(readiness.readyShotCount).toBe(8);
    expect(readiness.willCreateJob).toBe(false);
    expect(readiness.willCallProvider).toBe(false);
    expect(readiness.willGenerateImage).toBe(false);
    expect(readiness.estimatedCostUnits).toBe(8);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('blocks storyboard image readiness when an image asset already exists', async () => {
    const storyboardAssets = readyStoryboardAssets();
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets: [
          { ...storyboardAssets[0], assetKind: 'image', assetUrl: 'https://example.test/image.png' },
          ...storyboardAssets.slice(1),
        ],
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const readiness = await service.getStoryboardImageReadiness('project-1', 'org-1');

    expect(readiness.status).toBe('blocked');
    expect(readiness.blockers.join('\n')).toContain('不应生成图片');
    expect(readiness.imageAssetCount).toBe(1);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('returns a storyboard image dry-run plan without writing metadata or creating jobs', async () => {
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets: readyStoryboardAssets(),
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const dryRun = await service.dryRunStoryboardImageGeneration('project-1', 'org-1', {
      imageModel: 'gpt-image-1',
      imageSize: '16:9',
      imageQuality: 'standard',
      confirmCost: true,
    });

    expect(dryRun.status).toBe('ready');
    expect(dryRun.mode).toBe('dry_run');
    expect(dryRun.plannedImageCount).toBe(8);
    expect(dryRun.estimatedCostUnits).toBe(8);
    expect(dryRun.assets[0]).toEqual(
      expect.objectContaining({
        shotId: 'shot-script-1',
        sourceStoryboardAssetId: 'storyboard-asset-1',
        estimatedCostUnit: 1,
      })
    );
    expect(dryRun.willCreateJob).toBe(false);
    expect(dryRun.willCallProvider).toBe(false);
    expect(dryRun.willGenerateImage).toBe(false);
    expect(dryRun.willWriteMetadata).toBe(false);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('blocks storyboard image dry-run when cost is not confirmed or model is missing', async () => {
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets: readyStoryboardAssets(),
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const dryRun = await service.dryRunStoryboardImageGeneration('project-1', 'org-1', {});

    expect(dryRun.status).toBe('blocked');
    expect(dryRun.blockers.join('\n')).toContain('确认预计成本');
    expect(dryRun.blockers.join('\n')).toContain('选择图片模型');
    expect(dryRun.willGenerateImage).toBe(false);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('blocks generate-one when single-shot confirmations are missing', async () => {
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets: readyStoryboardAssets(),
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const result = await service.generateOneStoryboardImage('project-1', 'org-1', {
      shotId: 'shot-script-1',
      imageModel: 'gpt-image-1',
      imageSize: '16:9',
      imageQuality: 'standard',
    });

    expect(result.status).toBe('blocked');
    expect(result.blockers.join('\n')).toContain('必须确认预计成本');
    expect(result.blockers.join('\n')).toContain('必须确认不会生成视频');
    expect(result.providerCall.attempted).toBe(false);
    expect(result.willCreateJob).toBe(false);
    expect(result.willGenerateVideo).toBe(false);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('writes one mock image asset for a single ready text binding without creating jobs or video', async () => {
    const storyboardAssets = readyStoryboardAssets();
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets,
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const result = await service.generateOneStoryboardImage('project-1', 'org-1', {
      shotId: 'shot-script-1',
      imageModel: 'gpt-image-1',
      imageSize: '16:9',
      imageQuality: 'standard',
      confirmCost: true,
      confirmSingleShot: true,
      confirmNoVideo: true,
    });

    expect(result.status).toBe('ready');
    expect(result.asset).toEqual(
      expect.objectContaining({
        assetKind: 'image',
        sourceShotScriptId: 'shot-script-1',
        assetStorageKey: 'studio/storyboards/project-1/shot-script-1.mock.png',
        assetUrl: '/mock-assets/studio/storyboards/project-1/shot-script-1.png',
        imageProvider: 'mock',
        imageModel: 'gpt-image-1',
        generationMode: 'single_shot',
        locked: true,
      })
    );
    expect(result.providerCall).toEqual({
      attempted: true,
      provider: 'mock',
      model: 'gpt-image-1',
      confirmed: false,
    });
    expect(result.auditLog).toEqual(
      expect.objectContaining({
        planned: true,
        recorded: false,
        action: 'STUDIO_STORYBOARD_IMAGE_PROVIDER_CALL',
        resourceType: 'studio_storyboard_image_provider_call',
        resourceId: 'project-1:shot-script-1',
      })
    );
    expect(result.rollback).toEqual({
      required: false,
      reason: null,
      metadataWritten: true,
      metadataRestored: false,
    });
    expect(result.willCreateJob).toBe(false);
    expect(result.willGenerateVideo).toBe(false);
    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            animationStudio: expect.objectContaining({
              storyboardAssets: expect.arrayContaining([
                expect.objectContaining({
                  assetKind: 'text_binding',
                  sourceShotScriptId: 'shot-script-1',
                }),
                expect.objectContaining({
                  assetKind: 'image',
                  sourceShotScriptId: 'shot-script-1',
                }),
              ]),
            }),
          }),
        }),
      })
    );
  });

  it('records provider-call audit skeleton before mock provider write', async () => {
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets: readyStoryboardAssets(),
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    const auditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProjectStudioStoryboardAssetService(prisma as any, auditLogService as any);

    const result = await service.generateOneStoryboardImage('project-1', 'org-1', {
      shotId: 'shot-script-1',
      imageModel: 'gpt-image-1',
      imageSize: '16:9',
      imageQuality: 'standard',
      confirmCost: true,
      confirmSingleShot: true,
      confirmNoVideo: true,
    });

    expect(result.status).toBe('ready');
    expect(result.auditLog.recorded).toBe(true);
    expect(result.auditLog.preflightRecorded).toBe(true);
    expect(result.auditLog.providerAttemptRecorded).toBe(true);
    expect(result.auditLog.providerSuccessRecorded).toBe(true);
    expect(result.auditLog.providerFailureRecorded).toBe(false);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        action: 'STUDIO_STORYBOARD_IMAGE_PROVIDER_CALL',
        resourceType: 'studio_storyboard_image_provider_call',
        resourceId: 'project-1:shot-script-1',
        details: expect.objectContaining({
          projectId: 'project-1',
          shotId: 'shot-script-1',
          provider: 'mock',
          model: 'gpt-image-1',
          status: 'approved',
          willCreateJob: false,
          willGenerateVideo: false,
          phase: '3A-E',
        }),
      })
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          status: 'provider_attempt',
        }),
      })
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          status: 'provider_success',
        }),
      })
    );
  });

  it('returns failed rollback state when metadata write fails after provider result', async () => {
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets: readyStoryboardAssets(),
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    prisma.project.update.mockRejectedValueOnce(new Error('metadata write failed'));
    const auditLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProjectStudioStoryboardAssetService(prisma as any, auditLogService as any);

    const result = await service.generateOneStoryboardImage('project-1', 'org-1', {
      shotId: 'shot-script-1',
      imageModel: 'gpt-image-1',
      imageSize: '16:9',
      imageQuality: 'standard',
      confirmCost: true,
      confirmSingleShot: true,
      confirmNoVideo: true,
    });

    expect(result.status).toBe('failed');
    expect(result.asset).toBeNull();
    expect(result.blockers.join('\n')).toContain('metadata write failed');
    expect(result.providerCall).toEqual({
      attempted: true,
      provider: 'mock',
      model: 'gpt-image-1',
      confirmed: false,
    });
    expect(result.auditLog.preflightRecorded).toBe(true);
    expect(result.auditLog.providerAttemptRecorded).toBe(true);
    expect(result.auditLog.providerSuccessRecorded).toBe(true);
    expect(result.auditLog.providerFailureRecorded).toBe(true);
    expect(result.rollback).toEqual({
      required: true,
      reason: 'Provider returned an asset but metadata write failed; no worker/job/video was created.',
      metadataWritten: false,
      metadataRestored: false,
    });
    expect(result.willCreateJob).toBe(false);
    expect(result.willGenerateVideo).toBe(false);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          status: 'metadata_write_failed',
          willCreateJob: false,
          willGenerateVideo: false,
        }),
      })
    );
  });

  it('blocks openai provider skeleton even when real-image flags are present', async () => {
    process.env.STUDIO_STORYBOARD_IMAGE_PROVIDER = 'openai';
    process.env.ENABLE_STUDIO_REAL_IMAGE_GENERATION = 'true';
    process.env.OPENAI_API_KEY = 'test-key';
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets: readyStoryboardAssets(),
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const result = await service.generateOneStoryboardImage('project-1', 'org-1', {
      shotId: 'shot-script-1',
      imageModel: 'gpt-image-1',
      imageSize: '16:9',
      imageQuality: 'standard',
      confirmCost: true,
      confirmSingleShot: true,
      confirmNoVideo: true,
      confirmProviderCall: true,
      confirmRealImageGeneration: true,
    });

    expect(result.status).toBe('blocked');
    expect(result.blockers.join('\n')).toContain('provider skeleton');
    expect(result.providerCall).toEqual({
      attempted: false,
      provider: 'openai',
      model: 'gpt-image-1',
      confirmed: true,
    });
    expect(result.auditLog).toEqual(
      expect.objectContaining({
        planned: true,
        recorded: false,
        resourceId: 'project-1:shot-script-1',
      })
    );
    expect(result.willCreateJob).toBe(false);
    expect(result.willGenerateVideo).toBe(false);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('blocks openai provider when real-image environment gates are missing', async () => {
    process.env.STUDIO_STORYBOARD_IMAGE_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;
    const prisma = createPrismaMock({
      animationStudio: {
        storyBible: {
          status: 'ready',
          title: '表姑娘又又又又跑了',
        },
        shotScripts: readyShotScripts(),
        storyboardAssets: readyStoryboardAssets(),
        characterBibles: readyCharacterBibles(),
        locationBibles: readyLocationBibles(),
        videoPrompts: readyVideoPrompts(),
      },
    });
    const service = new ProjectStudioStoryboardAssetService(prisma as any);

    const result = await service.generateOneStoryboardImage('project-1', 'org-1', {
      shotId: 'shot-script-1',
      imageModel: 'gpt-image-1',
      imageSize: '16:9',
      imageQuality: 'standard',
      confirmCost: true,
      confirmSingleShot: true,
      confirmNoVideo: true,
    });

    expect(result.status).toBe('blocked');
    expect(result.blockers.join('\n')).toContain('ENABLE_STUDIO_REAL_IMAGE_GENERATION=true');
    expect(result.blockers.join('\n')).toContain('OPENAI_API_KEY');
    expect(result.blockers.join('\n')).toContain('confirmRealImageGeneration=true');
    expect(result.blockers.join('\n')).toContain('confirmProviderCall=true');
    expect(result.providerCall.attempted).toBe(false);
    expect(prisma.project.update).not.toHaveBeenCalled();
  });
});
