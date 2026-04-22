import { PrismaClient } from 'database';
import { ProcessorContext } from '../types/processor-context';
import { defaultLLMClient } from '../agents/llm-client';

export interface AssetExtractionResult {
  success: boolean;
  output?: any;
  error?: any;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * P5-C.2: Character & Asset Extraction Processor
 * Handles:
 * - CE13_CHARACTER_CARDS: Extract characters and aliases
 * - CE14_ASSET_LIST: Extract locations, props, and outfits
 */

/**
 * [CE13_CHARACTER_CARDS]
 */
export async function processCharacterCardsJob(
  ctx: ProcessorContext
): Promise<AssetExtractionResult> {
  const { prisma, job } = ctx;
  const { episodeId, projectId } = job.payload;

  if (!episodeId) {
    throw new Error('Missing episodeId for character extraction');
  }
  if (!projectId) {
    throw new Error('Missing projectId for character extraction');
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { sourceRef: { include: { chunk: true } } },
  });

  if (!episode || !episode.sourceRef) {
    throw new Error('Episode or SourceRef not found');
  }

  const text = episode.sourceRef.chunk?.contentPreview;
  if (!text) {
    throw new Error('Missing source text for character extraction');
  }

  const prompt = `
你是一位专业的文学分析师。请从以下片段中提取所有出现的人物，并识别他们的“主名”和“别名”（包括头衔、昵称、代词代指等）。

片段：
${text}

请返回 JSON 格式：
{
  "characters": [
    {
      "name": "主名 (如：张若尘)",
      "description": "性格或身份简述",
      "aliases": ["九王子", "尘哥", "他"]
    }
  ]
}
`;

  const result = await defaultLLMClient.call({
    systemPrompt: '你擅长角色抽取与共指消解。',
    userPrompt: prompt,
    responseFormat: 'json_object',
  });

  const characters = asRecordArray((result as Record<string, unknown>)?.characters);
  for (const char of characters) {
    const characterName = asNonEmptyString(char.name);
    if (!characterName) {
      continue;
    }

    // 1. Upsert Character (Main name is unique within project)
    const character = await prisma.character.upsert({
      where: {
        projectId_name: {
          projectId,
          name: characterName,
        },
      },
      update: {
        description: asNonEmptyString(char.description),
      },
      create: {
        projectId,
        name: characterName,
        description: asNonEmptyString(char.description),
        firstSeenSourceRefId: episode.sourceRefId,
      },
    });

    // 2. Upsert Aliases
    for (const alias of Array.isArray(char.aliases) ? char.aliases : []) {
      const aliasText = asNonEmptyString(alias);
      if (!aliasText || aliasText === characterName) {
        continue;
      }

        await prisma.characterAlias.upsert({
          where: {
            characterId_aliasText: {
              characterId: character.id,
              aliasText,
            },
          },
          update: {},
          create: {
            characterId: character.id,
            aliasText,
            type: 'NAME',
          },
        });
    }
  }

  return { success: true, output: { characterCount: characters.length } };
}

/**
 * [CE14_ASSET_LIST]
 */
export async function processAssetListJob(ctx: ProcessorContext): Promise<AssetExtractionResult> {
  const { prisma, job } = ctx;
  const { episodeId, projectId } = job.payload;

  if (!episodeId) {
    throw new Error('Missing episodeId for asset extraction');
  }
  if (!projectId) {
    throw new Error('Missing projectId for asset extraction');
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { sourceRef: { include: { chunk: true } } },
  });

  if (!episode || !episode.sourceRef) {
    throw new Error('Episode or SourceRef not found');
  }

  const text = episode.sourceRef.chunk?.contentPreview;
  if (!text) {
    throw new Error('Missing source text for asset extraction');
  }

  const prompt = `
从以下片段中提取环境资产：地点 (Location)、道具 (Prop)、服装 (Outfit)。

片段：
${text}

请返回 JSON：
{
  "locations": [{ "name": "名称", "description": "描述" }],
  "props": [{ "name": "名称", "description": "描述" }],
  "outfits": [{ "name": "名称", "description": "描述" }]
}
`;

  const result = await defaultLLMClient.call({
    systemPrompt: '你擅长资产提取与环境分析。',
    userPrompt: prompt,
    responseFormat: 'json_object',
  });

  // 1. Process Locations
  for (const loc of asRecordArray((result as Record<string, unknown>)?.locations)) {
      const name = asNonEmptyString(loc.name);
      if (!name) {
        continue;
      }

      await prisma.location.upsert({
        where: { projectId_name: { projectId, name } },
        update: { description: asNonEmptyString(loc.description) },
        create: {
          projectId,
          name,
          description: asNonEmptyString(loc.description),
          firstSeenSourceRefId: episode.sourceRefId,
        },
      });
  }

  // 2. Process Props
  for (const pr of asRecordArray((result as Record<string, unknown>)?.props)) {
      const name = asNonEmptyString(pr.name);
      if (!name) {
        continue;
      }

      await prisma.prop.upsert({
        where: { projectId_name: { projectId, name } },
        update: { description: asNonEmptyString(pr.description) },
        create: {
          projectId,
          name,
          description: asNonEmptyString(pr.description),
          firstSeenSourceRefId: episode.sourceRefId,
        },
      });
  }

  // 3. Process Outfits
  for (const out of asRecordArray((result as Record<string, unknown>)?.outfits)) {
      const name = asNonEmptyString(out.name);
      if (!name) {
        continue;
      }

      await prisma.outfit.upsert({
        where: { projectId_name: { projectId, name } },
        update: { description: asNonEmptyString(out.description) },
        create: {
          projectId,
          name,
          description: asNonEmptyString(out.description),
          firstSeenSourceRefId: episode.sourceRefId,
        },
      });
  }

  return { success: true };
}
