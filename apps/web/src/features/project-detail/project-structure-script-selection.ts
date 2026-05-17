import {
  ProjectStructureEpisodeNode,
  ProjectStructureProductionScript,
  ProjectStructureSceneNode,
  ProjectStructureShotNode,
} from '@scu/shared-types';

export interface ScriptSceneSelection {
  episodeId: string;
  sceneId: string;
}

export interface ScriptSceneReference {
  episode: ProjectStructureEpisodeNode;
  scene: ProjectStructureSceneNode;
  scriptedShots: ProjectStructureShotNode[];
}

const METADATA_TEXT_PATTERNS = [
  /^本书名称\s*[:：]/,
  /^本书作者\s*[:：]/,
  /^书名\s*[:：]/,
  /^作者\s*[:：]/,
  /^作品名称\s*[:：]/,
  /^作品作者\s*[:：]/,
  /^目录$/,
  /^第\s*\d+\s*[章节卷]\s*[:：]?\s*$/,
];

export function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isLikelyNovelMetadataShot(shot: ProjectStructureShotNode): boolean {
  const text = [
    shot.novelQuote,
    shot.description,
    shot.content,
    shot.visualDescription,
    shot.actionDescription,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  if (!text) return false;
  return METADATA_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasProductionScript(
  script: ProjectStructureProductionScript | null | undefined
): boolean {
  if (!script) return false;
  return Object.values(script).some((value) => hasText(value));
}

export function hasVideoScriptFields(shot: ProjectStructureShotNode): boolean {
  if (isLikelyNovelMetadataShot(shot)) return false;

  return (
    hasProductionScript(shot.productionScript) ||
    hasText(shot.visualDescription) ||
    hasText(shot.visualPrompt) ||
    hasText(shot.actionDescription) ||
    hasText(shot.dialogueContent) ||
    hasText(shot.cameraMovement) ||
    hasText(shot.cameraAngle)
  );
}

export function getScriptedSceneReferences(
  episodes: ProjectStructureEpisodeNode[]
): ScriptSceneReference[] {
  return episodes.flatMap((episode) =>
    episode.scenes
      .map((scene) => ({
        episode,
        scene,
        scriptedShots: scene.shots.filter((shot) => hasVideoScriptFields(shot)),
      }))
      .filter((item) => item.scriptedShots.length > 0)
  );
}

export function findFirstVideoScriptSelection(
  episodes: ProjectStructureEpisodeNode[]
): ScriptSceneSelection | null {
  for (const episode of episodes) {
    const scene = episode.scenes.find((item) =>
      item.shots.some((shot) => hasVideoScriptFields(shot))
    );
    if (scene) {
      return {
        episodeId: episode.id,
        sceneId: scene.id,
      };
    }
  }

  return null;
}
