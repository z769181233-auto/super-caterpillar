"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StructureGenerateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructureGenerateService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../prisma/prisma.service");
const project_service_1 = require("./project.service");
const scene_graph_service_1 = require("./scene-graph.service");
let StructureGenerateService = StructureGenerateService_1 = class StructureGenerateService {
    prisma;
    projectService;
    sceneGraphService;
    logger = new common_1.Logger(StructureGenerateService_1.name);
    constructor(prisma, projectService, sceneGraphService) {
        this.prisma = prisma;
        this.projectService = projectService;
        this.sceneGraphService = sceneGraphService;
    }
    async generateStructure(projectId, organizationId) {
        this.logger.log(`Starting generateStructure for projectId: ${projectId}, organizationId: ${organizationId}`);
        const project = await this.prisma.project.findFirst({
            where: {
                id: projectId,
                organizationId,
            },
            include: {
                novelSources: {
                    include: {
                        chapters: {
                            orderBy: { index: 'asc' },
                        },
                    },
                },
                episodes: {
                    include: {
                        scenes: true,
                    },
                },
            },
        });
        if (!project) {
            this.logger.error(`Project not found: ${projectId}`);
            throw new common_1.BadRequestException('项目不存在，无法生成结构');
        }
        this.logger.log(`Found project: ${project.name}, novelSource ID: ${project.novelSources?.id || 'none'}`);
        const novelSource = project.novelSources;
        if (!novelSource) {
            this.logger.error(`No novel source found for project: ${projectId}`);
            throw new common_1.NotFoundException('No novel source found for this project');
        }
        const chapters = novelSource.chapters || [];
        this.logger.log(`Found ${chapters.length} chapters in novel source: ${novelSource.id}`);
        const existingEpisodes = project.episodes || [];
        const hasExistingStructure = existingEpisodes.length > 0 &&
            existingEpisodes.some((e) => e.scenes && e.scenes.length > 0);
        if (hasExistingStructure) {
            this.logger.log(`Existing structure found, returning current structure (idempotent)`);
            return this.projectService.findTreeById(projectId, organizationId);
        }
        if (chapters.length === 0) {
            this.logger.error(`No chapters found in novel source: ${novelSource.id}`);
            throw new common_1.NotFoundException('当前项目没有可用的小说章节，请先导入并解析小说文件');
        }
        for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
            const chapter = chapters[chIdx];
            let episode = await this.prisma.episode.findFirst({
                where: {
                    projectId,
                    chapterId: chapter.id,
                },
            });
            if (!episode) {
                episode = await this.projectService.createEpisode(projectId, {
                    index: chIdx + 1,
                    name: chapter.title || `第 ${chapter.index} 章`,
                });
                await this.prisma.episode.update({
                    where: { id: episode.id },
                    data: { chapterId: chapter.id },
                });
                this.logger.log(`Episode ${chIdx + 1} created: ${episode.id} (Chapter: ${chapter.title})`);
            }
            const existingScenes = await this.prisma.scene.findMany({
                where: { episodeId: episode.id },
            });
            if (existingScenes.length > 0) {
                this.logger.log(`Episode ${episode.id} already has ${existingScenes.length} scenes, skipping`);
                continue;
            }
            const rawText = chapter.rawContent || '';
            const paragraphs = rawText.split(/\n\n+/).filter((p) => p.trim().length > 50);
            const sceneCount = Math.min(3, Math.max(1, Math.ceil(paragraphs.length / 3)));
            for (let scIdx = 0; scIdx < sceneCount; scIdx++) {
                const startIdx = Math.floor((paragraphs.length / sceneCount) * scIdx);
                const endIdx = Math.floor((paragraphs.length / sceneCount) * (scIdx + 1));
                const sceneParagraphs = paragraphs.slice(startIdx, endIdx);
                const sceneText = sceneParagraphs.join('\n\n');
                const summary = sceneText.substring(0, 100).trim() || `场景 ${scIdx + 1}`;
                const title = `${chapter.title} - 场景 ${scIdx + 1}`;
                const location = this.extractLocation(sceneText);
                const sceneDraft = await this.prisma.sceneDraft.create({
                    data: {
                        chapterId: chapter.id,
                        index: scIdx + 1,
                        title: title || '',
                        summary: summary || '',
                        location,
                        status: 'DRAFT',
                    },
                });
                this.logger.log(`SceneDraft created: ${sceneDraft.id}`);
                const scene = await this.projectService.createScene(episode.id, {
                    index: scIdx + 1,
                    title,
                    summary,
                    location,
                });
                await this.prisma.scene.update({
                    where: { id: scene.id },
                    data: { sceneDraftId: sceneDraft.id },
                });
                this.logger.log(`Scene ${scIdx + 1} created: ${scene.id}`);
            }
        }
        try {
            await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
            return this.projectService.findTreeById(projectId, organizationId);
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('项目结构分析失败，请稍后重试');
        }
    }
    extractLocation(text) {
        const locationPatterns = [/在([^，。！？\n]+)/, /到([^，。！？\n]+)/, /来到([^，。！？\n]+)/];
        for (const pattern of locationPatterns) {
            const match = text.match(pattern);
            if (match && match[1] && match[1].length < 20) {
                return match[1].trim();
            }
        }
        return undefined;
    }
    async applyAnalyzedStructureToDatabase(structure) {
        const { projectId, seasons, episodes } = structure;
        await this.prisma.$transaction(async (tx) => {
            await tx.episode.deleteMany({
                where: { projectId },
            });
            const itemsToProcess = episodes && episodes.length > 0 ? episodes : seasons?.flatMap((s) => s.episodes) || [];
            for (const episodeData of itemsToProcess) {
                const episode = await tx.episode.create({
                    data: {
                        projectId,
                        seasonId: null,
                        index: episodeData.index,
                        name: episodeData.title,
                        summary: episodeData.summary || undefined,
                    },
                });
                for (const sceneData of episodeData.scenes) {
                    const scene = await tx.scene.create({
                        data: {
                            episodeId: episode.id,
                            projectId,
                            sceneIndex: sceneData.index,
                            title: sceneData.title,
                            summary: sceneData.summary || undefined,
                        },
                    });
                    if (sceneData.shots && sceneData.shots.length > 0) {
                        await tx.shot.createMany({
                            data: sceneData.shots.map((shotData) => ({
                                sceneId: scene.id,
                                index: shotData.index,
                                title: shotData.title || null,
                                description: shotData.summary || shotData.text?.substring(0, 200) || null,
                                type: 'novel_analysis',
                                params: { sourceText: shotData.text },
                                qualityScore: {},
                            })),
                        });
                    }
                }
            }
        });
        await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
    }
    async handleCE06Completed(payload) {
        const { projectId, result } = payload;
        const items = result?.data?.seasons || result?.data?.volumes || result?.data?.episodes || [];
        if (items.length === 0) {
            this.logger.warn(`[Event] CE06 succeeded but no structure found for project ${projectId}`);
            return;
        }
        const episodes = result?.data?.episodes
            ? result.data.episodes
            : (result?.data?.seasons || result?.data?.volumes || []).flatMap((s) => s.episodes || []);
        this.logger.log(`[Event] Applying CE06 structure to DB for project ${projectId} (Found ${episodes.length} episodes)`);
        try {
            await this.applyAnalyzedStructureToDatabase({
                projectId,
                episodes: episodes,
                statis: {
                    seasonsCount: 0,
                    episodesCount: episodes.length,
                    scenesCount: 0,
                    shotsCount: 0,
                },
                stats: {
                    seasonsCount: 0,
                    episodesCount: episodes.length,
                    scenesCount: 0,
                    shotsCount: 0,
                },
            });
            this.logger.log(`[Event] Successfully applied CE06 structure for project ${projectId}`);
        }
        catch (error) {
            this.logger.error(`[Event] Failed to apply CE06 structure: ${error.message}`);
        }
    }
};
exports.StructureGenerateService = StructureGenerateService;
__decorate([
    (0, event_emitter_1.OnEvent)('job.ce06_succeeded', { async: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StructureGenerateService.prototype, "handleCE06Completed", null);
exports.StructureGenerateService = StructureGenerateService = StructureGenerateService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        project_service_1.ProjectService,
        scene_graph_service_1.SceneGraphService])
], StructureGenerateService);
//# sourceMappingURL=structure-generate.service.js.map