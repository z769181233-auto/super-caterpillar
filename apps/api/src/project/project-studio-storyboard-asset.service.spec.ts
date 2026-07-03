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
});
