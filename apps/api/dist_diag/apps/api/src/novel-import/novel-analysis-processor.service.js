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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovelAnalysisProcessorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let NovelAnalysisProcessorService = class NovelAnalysisProcessorService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async analyzeChapter(chapterId) {
        const chapter = await this.prisma.novelChapter.findUnique({
            where: { id: chapterId },
            include: {
                novelSource: true,
                scenes: {
                    take: 1,
                    orderBy: { sceneIndex: 'asc' },
                },
            },
        });
        if (!chapter) {
            throw new common_1.NotFoundException(`Chapter ${chapterId} not found`);
        }
        const rawText = chapter.content || '';
        const paragraphs = rawText.split(/\n\n+/).filter((p) => p.trim().length > 50);
        const sceneCount = Math.min(3, Math.max(1, Math.ceil(paragraphs.length / 3)));
        await this.prisma.sceneDraft.deleteMany({
            where: { chapterId },
        });
        for (let scIdx = 0; scIdx < sceneCount; scIdx++) {
            const startIdx = Math.floor((paragraphs.length / sceneCount) * scIdx);
            const endIdx = Math.floor((paragraphs.length / sceneCount) * (scIdx + 1));
            const sceneParagraphs = paragraphs.slice(startIdx, endIdx);
            const sceneText = sceneParagraphs.join('\n\n');
            const summary = sceneText.substring(0, 100).trim() || `场景 ${scIdx + 1}`;
            const characters = [];
            const location = this.extractLocation(sceneText);
            await this.prisma.sceneDraft.create({
                data: {
                    chapterId,
                    index: scIdx + 1,
                    title: `${chapter.title} - 场景 ${scIdx + 1}`,
                    summary,
                    characters: characters.length > 0 ? characters : undefined,
                    location,
                    rawTextRange: {
                        startParagraph: startIdx,
                        endParagraph: endIdx - 1,
                    },
                    status: 'ANALYZED',
                    analysisResult: {
                        method: 'rule-based',
                        timestamp: new Date().toISOString(),
                    },
                },
            });
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
};
exports.NovelAnalysisProcessorService = NovelAnalysisProcessorService;
exports.NovelAnalysisProcessorService = NovelAnalysisProcessorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NovelAnalysisProcessorService);
//# sourceMappingURL=novel-analysis-processor.service.js.map