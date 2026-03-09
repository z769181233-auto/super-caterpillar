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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptBuildService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const fs = __importStar(require("fs"));
let ScriptBuildService = class ScriptBuildService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOutline(buildId) {
        try {
            const build = await this.prisma.scriptBuild.findUnique({
                where: { id: buildId },
                include: {
                    storySource: true,
                    episodes: {
                        orderBy: { index: 'asc' },
                        include: {
                            sourceRef: true,
                            scenes: {
                                orderBy: { sceneIndex: 'asc' },
                                include: {
                                    sourceRef: true,
                                    shots: {
                                        orderBy: { index: 'asc' },
                                        include: { sourceRef: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });
            if (!build)
                throw new common_1.NotFoundException(`Build ${buildId} not found`);
            const stats = {
                episodes: build.episodes?.length || 0,
                scenes: build.episodes?.reduce((acc, ep) => acc + (ep.scenes?.length || 0), 0) || 0,
                shots: build.episodes?.reduce((acc, ep) => acc + (ep.scenes?.reduce((sAcc, sc) => sAcc + (sc.shots?.length || 0), 0) || 0), 0) || 0,
                characters: 0,
                coveragePercent: build.metadata?.coveragePercent || 0,
                totalBytes: build.storySource?.size || 0,
            };
            return {
                build: {
                    id: build.id,
                    projectId: build.projectId,
                    title: build.storySource?.title,
                    status: build.status,
                    auditId: build.metadata?.auditId || build.id.substring(0, 8),
                    globalHash: build.storySource?.globalHash,
                    createdAt: build.createdAt,
                },
                stats,
                episodes: build.episodes?.map((ep) => ({
                    id: ep.id,
                    index: ep.index,
                    title: ep.name,
                    startOffset: ep.sourceRef?.offsetStart,
                    endOffset: ep.sourceRef?.offsetEnd,
                    scenes: ep.scenes?.map((sc) => ({
                        id: sc.id,
                        index: sc.sceneIndex,
                        title: sc.summary || `Scene ${sc.sceneIndex}`,
                        startOffset: sc.sourceRef?.offsetStart,
                        endOffset: sc.sourceRef?.offsetEnd,
                        shots: sc.shots?.map((shot) => ({
                            id: shot.id,
                            index: shot.index,
                            summary: shot.content,
                            startOffset: shot.sourceRef?.offsetStart,
                            endOffset: shot.sourceRef?.offsetEnd,
                            sourceHash: shot.sourceRef?.textHash,
                        })) || [],
                    })) || [],
                })) || [],
            };
        }
        catch (error) {
            console.error('[ScriptBuildService.getOutline] ERROR:', error);
            throw error;
        }
    }
    async getShotSource(shotId, context = 400) {
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
            include: {
                sourceRef: true,
                scriptBuild: { include: { storySource: true } },
            },
        });
        if (!shot || !shot.sourceRef || !shot.scriptBuild)
            throw new common_1.NotFoundException(`Shot ${shotId} or its source/build reference not found`);
        const source = shot.scriptBuild.storySource;
        const filePath = source.path;
        if (!fs.existsSync(filePath))
            throw new common_1.NotFoundException(`Source file not found at ${filePath}`);
        const start = Math.max(0, shot.sourceRef.offsetStart - context);
        const end = Math.min(source.size, shot.sourceRef.offsetEnd + context);
        const length = end - start;
        const buffer = Buffer.alloc(length);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, length, start);
        fs.closeSync(fd);
        const excerpt = buffer.toString('utf8');
        return {
            shot: { id: shot.id, buildId: shot.buildId, summary: shot.content },
            source: {
                startOffset: shot.sourceRef.offsetStart,
                endOffset: shot.sourceRef.offsetEnd,
                sourceHash: shot.sourceRef.textHash,
                globalHash: source.globalHash,
                excerpt,
                excerptStart: start,
                excerptEnd: end,
            },
        };
    }
};
exports.ScriptBuildService = ScriptBuildService;
exports.ScriptBuildService = ScriptBuildService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ScriptBuildService);
//# sourceMappingURL=script-build.service.js.map