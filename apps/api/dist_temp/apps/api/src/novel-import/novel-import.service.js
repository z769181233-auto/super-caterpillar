"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NovelImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovelImportService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const project_service_1 = require("../project/project.service");
const novel_analysis_processor_service_1 = require("./novel-analysis-processor.service");
const crypto_1 = require("crypto");
const fs = __importStar(require("fs"));
let NovelImportService = NovelImportService_1 = class NovelImportService {
    prisma;
    projectService;
    analysisProcessor;
    logger = new common_1.Logger(NovelImportService_1.name);
    constructor(prisma, projectService, analysisProcessor) {
        this.prisma = prisma;
        this.projectService = projectService;
        this.analysisProcessor = analysisProcessor;
    }
    async analyzeChapter(chapterId) {
        await this.analysisProcessor.analyzeChapter(chapterId);
    }
    async analyzeNovelAndGenerateStructure(novelSourceId, projectId, userId, organizationId, chapters, savedChapters) {
        const novelSource = await this.prisma.novel.findUnique({
            where: { id: novelSourceId },
        });
        if (!novelSource) {
            throw new common_1.NotFoundException('当前项目没有可用的小说源，请先导入小说文件');
        }
        let chaptersToProcess = savedChapters;
        if (!chaptersToProcess) {
            const dbChapters = await this.prisma.novelChapter.findMany({
                where: { novelSourceId },
                orderBy: { index: 'asc' },
                include: { scenes: true },
            });
            chaptersToProcess = dbChapters.map((c) => ({
                id: c.id,
                index: c.index,
                title: c.title || `Chapter ${c.index}`,
                rawText: c.rawContent || '',
            }));
        }
        if (!chaptersToProcess || chaptersToProcess.length === 0) {
            throw new common_1.BadRequestException('小说章节为空或解析失败，请检查文件内容');
        }
        for (let chIdx = 0; chIdx < chaptersToProcess.length; chIdx++) {
            const chapter = chaptersToProcess[chIdx];
            this.logger.log(`Creating episode ${chIdx + 1} (Chapter: ${chapter.title})...`);
            const episode = await this.projectService.createEpisode(projectId, {
                index: chIdx + 1,
                name: chapter.title,
            });
            this.logger.log(`Episode ${chIdx + 1} created: ${episode.id}`);
            await this.prisma.episode.update({
                where: { id: episode.id },
                data: { chapterId: chapter.id },
            });
            const sceneDraft = await this.prisma.sceneDraft.create({
                data: {
                    chapterId: chapter.id,
                    index: 1,
                    title: `${chapter.title} - 场景 1`,
                    summary: chapter.rawText.substring(0, 100) || '场景摘要',
                    status: 'DRAFT',
                },
            });
            this.logger.log(`SceneDraft created: ${sceneDraft.id}`);
            const scene = await this.projectService.createScene(episode.id, {
                index: 1,
                summary: sceneDraft.summary || undefined,
                title: sceneDraft.title || undefined,
            });
            this.logger.log(`Scene created: ${scene.id}`);
            await this.prisma.scene.update({
                where: { id: scene.id },
                data: { sceneDraftId: sceneDraft.id },
            });
            const paragraphs = chapter.rawText.split(/\n\n+/).filter((p) => p.trim().length > 10);
            this.logger.log(`Segmenting chapter into ${paragraphs.length} paragraphs/shots...`);
            const shotsData = [];
            const maxShots = Math.min(paragraphs.length, 10);
            for (let shIdx = 0; shIdx < maxShots; shIdx++) {
                const paragraph = paragraphs[shIdx].trim();
                const shotParams = {
                    prompt: paragraph.substring(0, 800),
                    aspect_ratio: '16:9',
                    seed: Math.floor(Math.random() * 1000000),
                    engine_params: {
                        steps: 20,
                        guidance_scale: 7.0,
                        scheduler: 'DPMSolverMultistepScheduler',
                    },
                };
                const shot = await this.projectService.createShot(scene.id, {
                    index: shIdx + 1,
                    type: this.inferShotType(paragraph),
                    params: shotParams,
                    title: `Shot ${shIdx + 1}`,
                    description: paragraph.substring(0, 200),
                }, organizationId);
                shotsData.push({
                    shotId: shot.id,
                    index: shIdx + 1,
                    ...shotParams,
                });
            }
            this.logger.log(`[Stage-1 Evidence] Generated structure for Episode ${episode.id} with ${shotsData.length} shots.`);
        }
    }
    async callLLMForOutlineWithChapters(chapters, _title) {
        const episodes = [];
        for (let epIdx = 0; epIdx < chapters.length; epIdx++) {
            const chapter = chapters[epIdx];
            const scenes = [];
            const paragraphs = chapter.content.split(/\n\n+/).filter((p) => p.trim().length > 50);
            const sceneCount = Math.min(3, Math.max(1, Math.ceil(paragraphs.length / 3)));
            for (let scIdx = 0; scIdx < sceneCount; scIdx++) {
                const startIdx = Math.floor((paragraphs.length / sceneCount) * scIdx);
                const endIdx = Math.floor((paragraphs.length / sceneCount) * (scIdx + 1));
                const sceneParagraphs = paragraphs.slice(startIdx, endIdx);
                const sceneText = sceneParagraphs.join('\n\n');
                const shots = [];
                const shotCount = Math.min(5, Math.max(3, Math.ceil(sceneText.length / 500)));
                for (let shIdx = 0; shIdx < shotCount; shIdx++) {
                    const shotStart = Math.floor((sceneText.length / shotCount) * shIdx);
                    const shotEnd = Math.floor((sceneText.length / shotCount) * (shIdx + 1));
                    const shotText = sceneText.substring(shotStart, shotEnd);
                    shots.push({
                        title: `${chapter.title} - 场景 ${scIdx + 1} - 镜头 ${shIdx + 1}`,
                        description: shotText.substring(0, 200) || `场景 ${scIdx + 1} 的镜头 ${shIdx + 1}`,
                        type: this.inferShotType(shotText),
                    });
                }
                scenes.push({
                    summary: sceneParagraphs[0]?.substring(0, 100) || `场景 ${scIdx + 1}`,
                    shots,
                });
            }
            episodes.push({
                name: chapter.title,
                scenes,
            });
        }
        return { episodes };
    }
    async callLLMForOutline(rawText, _title) {
        const paragraphs = rawText.split(/\n\n+/).filter((p) => p.trim().length > 0);
        const episodes = [];
        const maxEpisodes = Math.min(3, paragraphs.length);
        for (let epIdx = 0; epIdx < maxEpisodes; epIdx++) {
            const paragraph = paragraphs[epIdx] || '';
            const scenes = [];
            for (let scIdx = 0; scIdx < 3; scIdx++) {
                const sceneText = paragraph.substring(Math.floor((paragraph.length / 3) * scIdx), Math.floor((paragraph.length / 3) * (scIdx + 1)));
                const shots = [];
                for (let shIdx = 0; shIdx < 5; shIdx++) {
                    const shotText = sceneText.substring(Math.floor((sceneText.length / 5) * shIdx), Math.floor((sceneText.length / 5) * (shIdx + 1)));
                    shots.push({
                        title: `第 ${epIdx + 1} 集 - 场景 ${scIdx + 1} - 镜头 ${shIdx + 1}`,
                        description: shotText.substring(0, 100) || `场景 ${scIdx + 1} 的镜头 ${shIdx + 1}`,
                        type: 'close-up',
                    });
                }
                scenes.push({
                    summary: `Scene ${scIdx + 1}`,
                    shots,
                });
            }
            episodes.push({
                name: `第 ${epIdx + 1} 集`,
                scenes,
            });
        }
        return { episodes };
    }
    async triggerShredderWorkflow(novelSourceId, projectId, organizationId, userId, filePath, title, traceId, isVerification) {
        this.logger.log(`[Stage 4] Triggering Shredder workflow for Novel: ${title} (${projectId})`);
        const stats = await fs.promises.stat(filePath).catch(() => ({ size: 0 }));
        const novelSource = await this.prisma.novelSource.upsert({
            where: { projectId },
            update: {
                fileKey: filePath,
                fileName: title,
                fileSize: stats.size,
                status: 'PENDING',
                error: null,
                totalChapters: 0,
                processedChunks: 0,
            },
            create: {
                projectId,
                organizationId,
                fileKey: filePath,
                fileName: title,
                fileSize: stats.size,
                status: 'PENDING',
            },
        });
        const task = await this.prisma.task.create({
            data: {
                organizationId,
                projectId,
                type: 'NOVEL_ANALYSIS',
                status: 'PENDING',
                traceId: traceId || `tr_shredder_${(0, crypto_1.randomUUID)()}`,
                payload: {
                    novelSourceId: novelSource.id,
                    projectId,
                    mode: 'SHREDDER',
                    isVerification: !!isVerification,
                },
            },
        });
        const job = await this.prisma.shotJob.create({
            data: {
                organizationId,
                projectId,
                taskId: task.id,
                type: 'NOVEL_SCAN_TOC',
                status: 'PENDING',
                priority: 100,
                maxRetry: 3,
                payload: {
                    novelSourceId: novelSource.id,
                    projectId,
                    organizationId,
                    userId,
                    fileKey: filePath,
                    title,
                    isVerification: !!isVerification,
                },
                traceId: task.traceId,
            },
        });
        this.logger.log(`[Stage 4] Shredder root job (NOVEL_SCAN_TOC) created: ${job.id}`);
        return {
            jobId: job.id,
            taskId: task.id,
            novelSourceId: novelSource.id,
        };
    }
    inferShotType(text) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('特写') || lowerText.includes('close') || lowerText.includes('face')) {
            return 'close_up';
        }
        if (lowerText.includes('全景') ||
            lowerText.includes('wide') ||
            lowerText.includes('landscape')) {
            return 'wide_shot';
        }
        return 'medium_shot';
    }
};
exports.NovelImportService = NovelImportService;
exports.NovelImportService = NovelImportService = NovelImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        project_service_1.ProjectService,
        novel_analysis_processor_service_1.NovelAnalysisProcessorService])
], NovelImportService);
//# sourceMappingURL=novel-import.service.js.map