import type {
  CreatePreviewVideoJobInput,
  EpisodeOutline,
  PreviewAsset,
  PreviewVideoJob,
  PreviewVideoProvider,
  SceneScript,
  ShotScript
} from '../../../packages/domain/src';
import { createId } from './id';

function now(): string {
  return new Date().toISOString();
}

export function preparePreviewVideoJob(input: {
  projectId: string;
  outline: EpisodeOutline;
  scenes: SceneScript[];
  shots: ShotScript[];
  issues: { severity: string; description: string }[];
  request?: CreatePreviewVideoJobInput;
}): PreviewVideoJob {
  const provider: PreviewVideoProvider = input.request?.provider || 'mock_storyboard';
  const objective = input.request?.objective?.trim() || '生成可供视频模型调用的预演包与镜头提示词';
  const warnings = input.issues
    .filter((issue) => issue.severity === 'high' || issue.severity === 'medium')
    .map((issue) => issue.description)
    .slice(0, 6);

  const promptPacket = buildPromptPacket({
    provider,
    outline: input.outline,
    scenes: input.scenes,
    shots: input.shots,
    objective,
    warnings
  });

  return {
    id: createId('preview'),
    projectId: input.projectId,
    episodeOutlineId: input.outline.id,
    episodeNo: input.outline.episodeNo,
    provider,
    status: 'prompt_ready',
    objective,
    requestSummary: `为第 ${input.outline.episodeNo} 集生成 ${provider} 预演交付包`,
    promptPacket,
    sceneCount: input.scenes.length,
    shotCount: input.shots.length,
    warnings,
    assets: buildAssets(input.outline, input.scenes, input.shots, warnings),
    createdAt: now(),
    updatedAt: now()
  };
}

function buildPromptPacket(input: {
  provider: PreviewVideoProvider;
  outline: EpisodeOutline;
  scenes: SceneScript[];
  shots: ShotScript[];
  objective: string;
  warnings: string[];
}): string {
  const sceneDigest = input.scenes
    .map(
      (scene) =>
        `场次${scene.sceneNo}｜${scene.location}｜目标:${scene.sceneGoal}｜冲突:${scene.conflictSource}｜情绪:${scene.emotionGoal}`
    )
    .join('\n');
  const shotDigest = input.shots
    .slice(0, 12)
    .map(
      (shot) =>
        `镜头${shot.shotNo}｜${shot.shotType}｜${shot.cameraAngle}/${shot.cameraMove}｜画面:${shot.visualFocus}｜表演:${shot.performanceFocus}`
    )
    .join('\n');

  return [
    `目标平台: ${input.provider}`,
    `任务目标: ${input.objective}`,
    `片名: ${input.outline.title}`,
    `集主题: ${input.outline.theme}`,
    `剧情一句话: ${input.outline.logline}`,
    `高潮设计: ${input.outline.climax}`,
    `尾钩设计: ${input.outline.endingHook}`,
    '',
    '分场摘要:',
    sceneDigest,
    '',
    '核心镜头摘要:',
    shotDigest,
    '',
    input.warnings.length > 0 ? `审查提醒: ${input.warnings.join('；')}` : '审查提醒: 当前无中高风险问题。',
    '输出要求: 保持国创动画分镜感、角色辨识度、场景连续性和情绪递进。'
  ].join('\n');
}

function buildAssets(
  outline: EpisodeOutline,
  scenes: SceneScript[],
  shots: ShotScript[],
  warnings: string[]
): PreviewAsset[] {
  return [
    {
      kind: 'storyboard_manifest',
      title: `${outline.title} 预演清单`,
      content: scenes
        .map((scene) => `场次${scene.sceneNo}｜${scene.title}｜角色:${scene.characters.join('、')}｜出点:${scene.exitResult}`)
        .join('\n')
    },
    {
      kind: 'camera_plan',
      title: `${outline.title} 镜头机位计划`,
      content: shots
        .map((shot) => `场次镜头${shot.shotNo}｜${shot.shotType}｜${shot.cameraAngle}/${shot.cameraMove}｜${shot.visualFocus}`)
        .join('\n')
    },
    {
      kind: 'prompt_sheet',
      title: `${outline.title} 视频提示词包`,
      content: [
        `主题:${outline.theme}`,
        `故事目标:${outline.storyGoal}`,
        `钩子:${outline.endingHook}`,
        warnings.length > 0 ? `风险:${warnings.join('；')}` : '风险:低'
      ].join('\n')
    }
  ];
}
