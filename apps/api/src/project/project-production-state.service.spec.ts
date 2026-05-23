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
              storyBible: {
                id: 'project-metadata:project-1:story-bible',
                status: 'done',
                version: 'studio-story-bible-v1',
              },
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

  it('marks characters ready when Studio CharacterBible records exist in project metadata', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [
                { id: 'character-1', name: '薛知盈', status: 'done' },
                { id: 'character-2', name: '萧昀祈', status: 'done' },
              ],
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
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [{ id: 'character-1', name: '薛知盈', status: 'done' }],
              locationBibles: [
                { id: 'location-1', name: '静水院', status: 'done' },
                { id: 'location-2', name: '云墨斋', status: 'done' },
              ],
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
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [{ id: 'character-1', name: '薛知盈', status: 'done' }],
              locationBibles: [{ id: 'location-1', name: '静水院', status: 'done' }],
              episodePlans: [
                { id: 'episode-plan-1', episodeNo: 1, title: '第一集', status: 'done' },
              ],
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
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [{ id: 'character-1', name: '薛知盈', status: 'done' }],
              locationBibles: [{ id: 'location-1', name: '静水院', status: 'done' }],
              episodePlans: [
                { id: 'episode-plan-1', episodeNo: 1, title: '第一集', status: 'done' },
              ],
              directorScripts: [
                {
                  id: 'director-script-1',
                  episodeId: 'episode-1',
                  title: '第一集',
                  status: 'done',
                },
              ],
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
      'blocked'
    );
    expect(state.shotScriptQualityGate).toEqual(
      expect.objectContaining({
        status: 'blocked',
        source: 'studio_director_scripts',
        candidateShotCount: 0,
      })
    );
    expect(state.riskFlags.join('\n')).toContain('镜头台本文本质量不足');
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
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [{ id: 'character-1', name: '薛知盈', status: 'done' }],
              locationBibles: [{ id: 'location-1', name: '静水院', status: 'done' }],
              episodePlans: [{ id: 'episode-plan-1', status: 'done' }],
              directorScripts: [
                {
                  id: 'director-script-1',
                  episodeId: 'episode-1',
                  title: '第一集',
                  status: 'done',
                  keyLocations: ['静水院'],
                  sourceEvidence: [
                    'scene-candidate:chapter-1:scene-candidate:1 | confidence:high | sourceBlocks:1 | location:静水院 | characters:薛知盈 | dialogueBlocks:1 | actionBlocks:1 | text:薛知盈说：“不能被发现。”',
                    'scene-candidate:chapter-1:scene-candidate:2 | confidence:high | sourceBlocks:2 | location:静水院 | characters:薛知盈 | dialogueBlocks:2 | actionBlocks:2 | text:旧摘要：薛知盈藏起书页。',
                  ],
                },
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
        candidateShotCount: 2,
        minShotCount: 4,
        dialogueExtractionRate: 1,
        characterBindingRate: 1,
        locationBindingRate: 1,
        evidenceBindingRate: 1,
        hasPlaceholderText: true,
      })
    );
    expect(state.shotScriptQualityGate.reasons).toEqual(
      expect.arrayContaining([
        '镜头候选数不足：2/4',
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
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [{ id: 'character-1', name: '薛知盈', status: 'done' }],
              locationBibles: [{ id: 'location-1', name: '静水院', status: 'done' }],
              episodePlans: [{ id: 'episode-plan-1', status: 'done' }],
              directorScripts: [
                {
                  id: 'director-script-1',
                  episodeId: 'episode-1',
                  title: '第一集',
                  status: 'done',
                  keyLocations: ['静水院'],
                  sourceEvidence,
                },
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
        status: 'passed',
        source: 'studio_director_scripts',
        candidateShotCount: 4,
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
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [{ id: 'character-1', status: 'done' }],
              locationBibles: [{ id: 'location-1', status: 'done' }],
              episodePlans: [{ id: 'episode-plan-1', status: 'done' }],
              directorScripts: [{ id: 'director-script-1', status: 'done' }],
              shotScripts: [
                {
                  shot_id: 'shot-script-1',
                  episode_id: 'episode-1',
                  shot_no: 1,
                  status: 'ready',
                },
              ],
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
      'Project.metadata.animationStudio.shotScripts:1'
    );
    expect(state.stages.find((stage) => stage.key === 'storyboard_ready')?.status).toBe(
      'missing'
    );
    expect(state.riskFlags.join('\n')).toContain(
      'ShotScript 已生成；StoryboardAsset 尚未真实生成'
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
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [{ id: 'character-1', status: 'done' }],
              locationBibles: [{ id: 'location-1', status: 'done' }],
              episodePlans: [{ id: 'episode-plan-1', status: 'done' }],
              directorScripts: [{ id: 'director-script-1', status: 'done' }],
              shotScripts: [{ shot_id: 'shot-script-1', status: 'ready' }],
              storyboardAssets: [
                {
                  id: 'storyboard-asset-1',
                  shotId: 'shot-script-1',
                  status: 'done',
                  assetKind: 'text_binding',
                  assetUrl: null,
                },
              ],
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
      'Project.metadata.animationStudio.storyboardAssets:1'
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
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [{ id: 'character-1', status: 'done' }],
              locationBibles: [{ id: 'location-1', status: 'done' }],
              episodePlans: [{ id: 'episode-plan-1', status: 'done' }],
              directorScripts: [{ id: 'director-script-1', status: 'done' }],
              shotScripts: [{ shot_id: 'shot-script-1', status: 'ready' }],
              storyboardAssets: [
                {
                  id: 'storyboard-asset-1',
                  shotId: 'shot-script-1',
                  status: 'done',
                  assetKind: 'image',
                  assetUrl: '/api/storage/signed/studio/storyboards/project-1/shot-script-1.png',
                  assetStorageKey: 'studio/storyboards/project-1/shot-script-1.png',
                },
              ],
            },
          },
        }),
      },
    });
    const service = new ProjectProductionStateService(prisma as any);

    const state = await service.getProductionState('project-1', 'org-1');

    expect(state.stages.find((stage) => stage.key === 'storyboard_ready')?.evidence).toContain(
      'Studio image storyboard assets:1'
    );
    expect(state.riskFlags.join('\n')).toContain(
      '真实单镜头 Storyboard 图像资产已生成'
    );
  });

  it('marks video prompt ready only when Studio VideoPrompt metadata exists', async () => {
    const prisma = createPrismaMock({
      project: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'project-1',
          name: '测试项目',
          status: 'in_progress',
          metadata: {
            animationStudio: {
              storyBible: { id: 'story-bible-1', status: 'done' },
              characterBibles: [{ id: 'character-1', status: 'done' }],
              locationBibles: [{ id: 'location-1', status: 'done' }],
              episodePlans: [{ id: 'episode-plan-1', status: 'done' }],
              directorScripts: [{ id: 'director-script-1', status: 'done' }],
              shotScripts: [{ shot_id: 'shot-script-1', status: 'ready' }],
              storyboardAssets: [
                {
                  id: 'storyboard-asset-1',
                  shotId: 'shot-script-1',
                  status: 'done',
                },
              ],
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
      'done'
    );
    expect(state.stages.find((stage) => stage.key === 'video_prompt_ready')?.evidence).toContain(
      'Project.metadata.animationStudio.videoPrompts:1'
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
