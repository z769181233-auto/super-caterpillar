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
var PipelineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
function nowIso() {
    return new Date().toISOString();
}
function mkNodeId(type, id) {
    return `${type}:${id}`;
}
function coerceGateStatus(v) {
    if (!v)
        return undefined;
    const s = String(v).toUpperCase();
    if (s === 'PASS' || s === 'WARN' || s === 'FAIL' || s === 'PENDING')
        return s;
    return undefined;
}
let PipelineService = PipelineService_1 = class PipelineService {
    prisma;
    logger = new common_1.Logger(PipelineService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPipeline(projectId) {
        const project = await this.prisma.project
            .findUnique({ where: { id: projectId } })
            .catch(() => null);
        const jobs = await this.prisma.job
            .findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 500,
            select: {
                id: true,
                status: true,
                type: true,
                engineKey: true,
                createdAt: true,
                sceneId: true,
                shotId: true,
            },
        })
            .catch(() => []);
        const lastJobByScene = new Map();
        const lastJobByShot = new Map();
        for (const j of jobs) {
            if (j.sceneId && !lastJobByScene.has(j.sceneId))
                lastJobByScene.set(j.sceneId, j);
            if (j.shotId && !lastJobByShot.has(j.shotId))
                lastJobByShot.set(j.shotId, j);
        }
        const anyProject = project || {};
        const structure = anyProject.structureJson || anyProject.structure || null;
        const root = {
            nodeId: mkNodeId('PROJECT', projectId),
            type: 'PROJECT',
            refId: projectId,
            title: anyProject.name || 'Project',
            children: [],
        };
        if (!structure || typeof structure !== 'object') {
            return { projectId, updatedAt: nowIso(), root };
        }
        const seasons = structure.seasons;
        if (!Array.isArray(seasons)) {
            return { projectId, updatedAt: nowIso(), root };
        }
        root.children = seasons.map((s) => {
            const seasonNode = {
                nodeId: mkNodeId('SEASON', String(s.id)),
                type: 'SEASON',
                refId: String(s.id),
                index: s.index,
                title: s.title || `Season ${s.index ?? ''}`.trim(),
                children: [],
            };
            const episodes = Array.isArray(s.episodes) ? s.episodes : [];
            seasonNode.children = episodes.map((e) => {
                const episodeNode = {
                    nodeId: mkNodeId('EPISODE', String(e.id)),
                    type: 'EPISODE',
                    refId: String(e.id),
                    index: e.index,
                    title: e.name || `Episode ${e.index ?? ''}`.trim(),
                    children: [],
                };
                const scenes = Array.isArray(e.scenes) ? e.scenes : [];
                episodeNode.children = scenes.map((sc) => {
                    const sid = String(sc.id);
                    const j = lastJobByScene.get(sid);
                    const sceneNode = {
                        nodeId: mkNodeId('SCENE', sid),
                        type: 'SCENE',
                        refId: sid,
                        index: sc.index,
                        title: sc.title || `Scene ${sc.index ?? ''}`.trim(),
                        canGenerate: sc.canGenerate,
                        qaStatus: coerceGateStatus(sc.qaStatus),
                        blockingReason: sc.blockingReason ?? null,
                        lastJob: j
                            ? {
                                id: j.id,
                                status: j.status,
                                type: j.type,
                                engineKey: j.engineKey,
                                createdAt: j.createdAt?.toISOString?.() ?? String(j.createdAt),
                            }
                            : null,
                        children: [],
                    };
                    const shots = Array.isArray(sc.shots) ? sc.shots : [];
                    sceneNode.children = shots.map((sh) => {
                        const hid = String(sh.id);
                        const jj = lastJobByShot.get(hid);
                        const shotNode = {
                            nodeId: mkNodeId('SHOT', hid),
                            type: 'SHOT',
                            refId: hid,
                            index: sh.index,
                            title: sh.title || `Shot ${sh.index ?? ''}`.trim(),
                            canGenerate: sh.canGenerate,
                            qaStatus: coerceGateStatus(sh.qaStatus),
                            blockingReason: sh.blockingReason ?? null,
                            lastJob: jj
                                ? {
                                    id: jj.id,
                                    status: jj.status,
                                    type: jj.type,
                                    engineKey: jj.engineKey,
                                    createdAt: jj.createdAt?.toISOString?.() ?? String(jj.createdAt),
                                }
                                : null,
                        };
                        return shotNode;
                    });
                    return sceneNode;
                });
                return episodeNode;
            });
            return seasonNode;
        });
        return { projectId, updatedAt: nowIso(), root };
    }
    async retryNode(projectId, nodeId, actorId, reason) {
        const { type, refId } = this.parseNodeId(nodeId);
        const where = { projectId };
        if (type === 'SCENE')
            where.sceneId = refId;
        if (type === 'SHOT')
            where.shotId = refId;
        const job = await this.prisma.job
            .findFirst({
            where,
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true },
        })
            .catch(() => null);
        if (!job) {
            throw new Error('No job found for this node');
        }
        await this.writeAudit(projectId, actorId, 'PIPELINE_NODE_RETRY', {
            nodeId,
            jobId: job.id,
            reason,
        });
        return { ok: true, jobId: job.id };
    }
    async skipNode(projectId, nodeId, actorId, reason) {
        if (!reason || reason.trim().length < 3) {
            throw new Error('Reason is required');
        }
        await this.writeAudit(projectId, actorId, 'PIPELINE_NODE_SKIP', { nodeId, reason });
        return { ok: true };
    }
    async forcePassNode(projectId, nodeId, actorId, reason) {
        if (!reason || reason.trim().length < 3) {
            throw new Error('Reason is required');
        }
        await this.writeAudit(projectId, actorId, 'PIPELINE_NODE_FORCE_PASS', { nodeId, reason });
        return { ok: true };
    }
    parseNodeId(nodeId) {
        const [t, id] = String(nodeId).split(':');
        const type = (t || '').toUpperCase();
        const refId = id || '';
        if (!refId)
            throw new Error('Invalid nodeId');
        if (!['PROJECT', 'SEASON', 'EPISODE', 'SCENE', 'SHOT'].includes(type))
            throw new Error('Invalid node type');
        return { type, refId };
    }
    async writeAudit(projectId, actorId, action, payload) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    projectId,
                    actorId,
                    action,
                    payload,
                    traceId: payload?.traceId || null,
                    createdAt: new Date(),
                },
            });
        }
        catch (e) {
            this.logger.error(`[AUDIT_WRITE_FAILED] ${e instanceof Error ? e.message : String(e)}`);
        }
    }
};
exports.PipelineService = PipelineService;
exports.PipelineService = PipelineService = PipelineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PipelineService);
//# sourceMappingURL=pipeline.service.js.map