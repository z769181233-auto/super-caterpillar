import { PrismaClient } from 'database';
import { ProcessorContext } from '../types/processor-context';
import { defaultLLMClient } from '../agents/llm-client';

export interface AssetExtractionResult {
    success: boolean;
    output?: any;
    error?: any;
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
export async function processCharacterCardsJob(ctx: ProcessorContext): Promise<AssetExtractionResult> {
    const { prisma, job } = ctx;
    const { episodeId, projectId } = job.payload;

    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: { sourceRef: { include: { chunk: true } } }
    });

    if (!episode || !episode.sourceRef) {
        throw new Error('Episode or SourceRef not found');
    }

    const text = episode.sourceRef.chunk?.contentPreview || "Mock text for character extraction";

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
        systemPrompt: "你擅长角色抽取与共指消解。",
        userPrompt: prompt,
        responseFormat: 'json_object'
    });

    const characters = result.characters || [];
    for (const char of characters) {
        // 1. Upsert Character (Main name is unique within project)
        const character = await prisma.character.upsert({
            where: {
                projectId_name: {
                    projectId,
                    name: char.name
                }
            },
            update: {
                description: char.description
            },
            create: {
                projectId,
                name: char.name,
                description: char.description,
                firstSeenSourceRefId: episode.sourceRefId
            }
        });

        // 2. Upsert Aliases
        if (char.aliases && Array.isArray(char.aliases)) {
            for (const aliasText of char.aliases) {
                await prisma.characterAlias.upsert({
                    where: {
                        characterId_aliasText: {
                            characterId: character.id,
                            aliasText
                        }
                    },
                    update: {},
                    create: {
                        characterId: character.id,
                        aliasText,
                        type: 'NAME'
                    }
                });
            }
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

    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: { sourceRef: { include: { chunk: true } } }
    });

    if (!episode || !episode.sourceRef) {
        throw new Error('Episode or SourceRef not found');
    }

    const text = episode.sourceRef.chunk?.contentPreview || "Mock text for asset extraction";

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
        systemPrompt: "你擅长资产提取与环境分析。",
        userPrompt: prompt,
        responseFormat: 'json_object'
    });

    // 1. Process Locations
    if (result.locations) {
        for (const loc of result.locations) {
            await prisma.location.upsert({
                where: { projectId_name: { projectId, name: loc.name } },
                update: { description: loc.description },
                create: {
                    projectId,
                    name: loc.name,
                    description: loc.description,
                    firstSeenSourceRefId: episode.sourceRefId
                }
            });
        }
    }

    // 2. Process Props
    if (result.props) {
        for (const pr of result.props) {
            await prisma.prop.upsert({
                where: { projectId_name: { projectId, name: pr.name } },
                update: { description: pr.description },
                create: {
                    projectId,
                    name: pr.name,
                    description: pr.description,
                    firstSeenSourceRefId: episode.sourceRefId
                }
            });
        }
    }

    // 3. Process Outfits
    if (result.outfits) {
        for (const out of result.outfits) {
            await prisma.outfit.upsert({
                where: { projectId_name: { projectId, name: out.name } },
                update: { description: out.description },
                create: {
                    projectId,
                    name: out.name,
                    description: out.description,
                    firstSeenSourceRefId: episode.sourceRefId
                }
            });
        }
    }

    return { success: true };
}
