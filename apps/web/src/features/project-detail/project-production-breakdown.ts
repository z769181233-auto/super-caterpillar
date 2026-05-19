import {
  ProjectStructureEpisodeNode,
  ProjectStructureSceneNode,
  ProjectStructureShotNode,
} from '@scu/shared-types';
import { hasText, hasVideoScriptFields } from './project-structure-script-selection';

export interface CharacterDesignCard {
  name: string;
  episodeCount: number;
  sceneCount: number;
  firstAppearance: string;
  roleLine: string;
  visualReference: string;
  performanceDirection: string;
  costumeAndProps: string;
}

export interface StoryboardShotLine {
  shot: ProjectStructureShotNode;
  status: StoryboardShotStatus;
}

export type StoryboardShotStatus = 'IMAGE_ASSET' | 'TEXT_SCRIPT' | 'PENDING';

export interface StoryboardSceneLine {
  scene: ProjectStructureSceneNode;
  shots: StoryboardShotLine[];
}

export interface EpisodeStoryboardBoard {
  episode: ProjectStructureEpisodeNode;
  sceneCount: number;
  shotCount: number;
  scriptedShotCount: number;
  imageAssetCount: number;
  scenes: StoryboardSceneLine[];
}

export interface ProductionBreakdown {
  characterCards: CharacterDesignCard[];
  episodeBoards: EpisodeStoryboardBoard[];
}

function getShotImageAssetUrl(shot: ProjectStructureShotNode): string {
  const value = (shot as ProjectStructureShotNode & { resultImageUrl?: unknown }).resultImageUrl;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCharacterValue(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeCharacterValue(item));
  }

  if (typeof value === 'string') {
    return value
      .split(/[、,，/]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const directName = record.name || record.characterName || record.canonicalName || record.label;
    if (typeof directName === 'string' && directName.trim()) {
      return [directName.trim()];
    }
    return Object.values(record).flatMap((item) => normalizeCharacterValue(item));
  }

  return [];
}

function compactText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function getSceneSource(scene: ProjectStructureSceneNode): string {
  return (
    compactText(scene.summary, 180) ||
    compactText(scene.directingNotes, 180) ||
    compactText(scene.enrichedText, 180) ||
    compactText(scene.shots.find((shot) => hasText(shot.content))?.content, 180) ||
    compactText(scene.shots.find((shot) => hasText(shot.description))?.description, 180) ||
    '当前分析结果暂未沉淀稳定人物语义，需要后续角色设定生成补全。'
  );
}

function getVisualReference(scenes: ProjectStructureSceneNode[]): string {
  const scriptedShot = scenes
    .flatMap((scene) => scene.shots)
    .find((shot) => hasText(shot.visualDescription) || hasText(shot.visualPrompt));

  return (
    compactText(scriptedShot?.visualDescription || scriptedShot?.visualPrompt, 180) ||
    '视觉参考待生成：需要补充三视图、表情组、发型发饰、服装材质、随身物品与色彩规范。'
  );
}

function getCostumeAndProps(scenes: ProjectStructureSceneNode[]): string {
  const source = scenes
    .flatMap((scene) => scene.shots)
    .map((shot) => `${shot.visualDescription || ''} ${shot.novelQuote || ''} ${shot.content || ''}`)
    .join(' ');

  const props = ['书', '帕', '簪', '钗', '剑', '玉', '伞', '篮', '衣', '裙', '袖', '发'];
  const found = props.filter((item) => source.includes(item)).slice(0, 6);
  if (found.length > 0) {
    return `已识别服饰/道具线索：${found.join('、')}。后续可扩展为服装细节、材质、配饰和随身道具清单。`;
  }
  return '服装与道具待细化：需要从原文和美术方向继续抽取服饰、材质、发饰、随身物品。';
}

export function deriveProductionBreakdown(
  episodes: ProjectStructureEpisodeNode[]
): ProductionBreakdown {
  const characterScenes = new Map<
    string,
    { episodes: Set<string>; scenes: ProjectStructureSceneNode[]; firstAppearance: string }
  >();

  for (const episode of episodes) {
    for (const scene of episode.scenes) {
      const names = Array.from(new Set(normalizeCharacterValue(scene.characters)));
      for (const name of names) {
        const current =
          characterScenes.get(name) ||
          {
            episodes: new Set<string>(),
            scenes: [],
            firstAppearance: `第 ${episode.index} 集 / 场景 ${scene.index}`,
          };
        current.episodes.add(episode.id);
        current.scenes.push(scene);
        characterScenes.set(name, current);
      }
    }
  }

  const characterCards = Array.from(characterScenes.entries())
    .map(([name, item]) => {
      const firstScene = item.scenes[0];
      const source = getSceneSource(firstScene);
      return {
        name,
        episodeCount: item.episodes.size,
        sceneCount: item.scenes.length,
        firstAppearance: item.firstAppearance,
        roleLine: source,
        visualReference: getVisualReference(item.scenes),
        performanceDirection: `表演方向：围绕“${compactText(source, 90)}”处理眼神、动作节奏和情绪转折。`,
        costumeAndProps: getCostumeAndProps(item.scenes),
      };
    })
    .sort((a, b) => b.sceneCount - a.sceneCount || a.name.localeCompare(b.name, 'zh-Hans'))
    .slice(0, 12);

  const episodeBoards: EpisodeStoryboardBoard[] = episodes.map((episode) => {
    const scenes = episode.scenes.map((scene) => ({
      scene,
      shots: scene.shots.map((shot) => ({
        shot,
        status: (hasText(getShotImageAssetUrl(shot))
          ? 'IMAGE_ASSET'
          : hasVideoScriptFields(shot)
            ? 'TEXT_SCRIPT'
            : 'PENDING') as StoryboardShotStatus,
      })),
    }));
    const allShots = scenes.flatMap((scene) => scene.shots);

    return {
      episode,
      sceneCount: episode.scenes.length,
      shotCount: allShots.length,
      scriptedShotCount: allShots.filter((item) => item.status !== 'PENDING').length,
      imageAssetCount: allShots.filter((item) => item.status === 'IMAGE_ASSET').length,
      scenes,
    };
  });

  return { characterCards, episodeBoards };
}
