import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetPipelineResponse, PipelineNode, PipelineNodeType, GateStatus } from './pipeline.dto';

function nowIso() {
    return new Date().toISOString();
}

function mkNodeId(type: PipelineNodeType, id: string) {
    return `${type}:${id}`;
}

function coerceGateStatus(v: any): GateStatus | undefined {
    if (!v) return undefined;
    const s = String(v).toUpperCase();
    if (s === 'PASS' || s === 'WARN' || s === 'FAIL' || s === 'PENDING') return s as GateStatus;
    return undefined;
}

@Injectable()
export class PipelineService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Pipeline 视图：以“项目结构树”为主（稳定来源），jobs 作为补充信息（弱依赖）。
     * 不改变任何执行链，仅用于观测与控制面。
     */
    async getPipeline(projectId: string): Promise<GetPipelineResponse> {
        // 结构树：复用你们现有 project structure 数据源（DB / service 都可）
        // 这里直接从 Prisma 假设存在 ProjectStructureTree/Season/Episode/Scene/Shot 的表结构不一定可靠，
        // 所以采用：先查 project + 现有结构树 JSON（如有），否则回退只返回 PROJECT 节点。
        // ✅ 最安全策略：尽量复用“已有 API 的实现逻辑”。因此这里用最小 DB 查询 + 结构字段容错。

        const project = await this.prisma.project.findUnique({ where: { id: projectId } }).catch(() => null);

        // jobs 作为补充：取每个 scene/shot 的最近一条 job（弱依赖）
        // WORKAROUND: Cast to any as Job model definitions might be missing in current generated client
        const jobs = await (this.prisma as any).job.findMany({
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
            } as any,
        }).catch(() => []);

        const lastJobByScene = new Map<string, any>();
        const lastJobByShot = new Map<string, any>();
        for (const j of jobs as any[]) {
            if (j.sceneId && !lastJobByScene.has(j.sceneId)) lastJobByScene.set(j.sceneId, j);
            if (j.shotId && !lastJobByShot.has(j.shotId)) lastJobByShot.set(j.shotId, j);
        }

        // 尝试读取结构树（如果你们结构树是通过表或 JSON 存储，这里需要按实际字段调整）
        // 最小化假设：Project 上可能有 structureJson / structure 字段；否则返回空结构
        const anyProject: any = project || {};
        const structure = anyProject.structureJson || anyProject.structure || null;

        const root: PipelineNode = {
            nodeId: mkNodeId('PROJECT', projectId),
            type: 'PROJECT',
            refId: projectId,
            title: anyProject.name || 'Project',
            children: [],
        };

        if (!structure || typeof structure !== 'object') {
            return { projectId, updatedAt: nowIso(), root };
        }

        // 兼容你们 web 端 ProjectStructureTree 的形态（seasons -> episodes -> scenes -> shots）
        const seasons = (structure as any).seasons;
        if (!Array.isArray(seasons)) {
            return { projectId, updatedAt: nowIso(), root };
        }

        root.children = seasons.map((s: any) => {
            const seasonNode: PipelineNode = {
                nodeId: mkNodeId('SEASON', String(s.id)),
                type: 'SEASON',
                refId: String(s.id),
                index: s.index,
                title: s.title || `Season ${s.index ?? ''}`.trim(),
                children: [],
            };

            const episodes = Array.isArray(s.episodes) ? s.episodes : [];
            seasonNode.children = episodes.map((e: any) => {
                const episodeNode: PipelineNode = {
                    nodeId: mkNodeId('EPISODE', String(e.id)),
                    type: 'EPISODE',
                    refId: String(e.id),
                    index: e.index,
                    title: e.name || `Episode ${e.index ?? ''}`.trim(),
                    children: [],
                };

                const scenes = Array.isArray(e.scenes) ? e.scenes : [];
                episodeNode.children = scenes.map((sc: any) => {
                    const sid = String(sc.id);
                    const j = lastJobByScene.get(sid);
                    const sceneNode: PipelineNode = {
                        nodeId: mkNodeId('SCENE', sid),
                        type: 'SCENE',
                        refId: sid,
                        index: sc.index,
                        title: sc.title || `Scene ${sc.index ?? ''}`.trim(),
                        canGenerate: sc.canGenerate,
                        qaStatus: coerceGateStatus(sc.qaStatus),
                        blockingReason: sc.blockingReason ?? null,
                        lastJob: j ? {
                            id: j.id,
                            status: j.status,
                            type: j.type,
                            engineKey: j.engineKey,
                            createdAt: j.createdAt?.toISOString?.() ?? String(j.createdAt),
                        } : null,
                        children: [],
                    };

                    const shots = Array.isArray(sc.shots) ? sc.shots : [];
                    sceneNode.children = shots.map((sh: any) => {
                        const hid = String(sh.id);
                        const jj = lastJobByShot.get(hid);
                        const shotNode: PipelineNode = {
                            nodeId: mkNodeId('SHOT', hid),
                            type: 'SHOT',
                            refId: hid,
                            index: sh.index,
                            title: sh.title || `Shot ${sh.index ?? ''}`.trim(),
                            canGenerate: sh.canGenerate,
                            qaStatus: coerceGateStatus(sh.qaStatus),
                            blockingReason: sh.blockingReason ?? null,
                            lastJob: jj ? {
                                id: jj.id,
                                status: jj.status,
                                type: jj.type,
                                engineKey: jj.engineKey,
                                createdAt: jj.createdAt?.toISOString?.() ?? String(jj.createdAt),
                            } : null,
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

    // ============ 控制面动作（只写审计 + 触发最小状态变更）===========

    /**
     * retry：对 node 关联的最近 job 进行 retry（若存在），否则返回 400
     * ✅ 最小化影响：复用现有 job retry 逻辑（DB 层仅写审计 + 调用已有 service/或写 job 状态为 PENDING）
     */
    async retryNode(projectId: string, nodeId: string, actorId: string, reason?: string) {
        const { type, refId } = this.parseNodeId(nodeId);

        // 找 job：scene -> last job by scene；shot -> last job by shot
        const where: any = { projectId };
        if (type === 'SCENE') where.sceneId = refId;
        if (type === 'SHOT') where.shotId = refId;

        const job = await (this.prisma as any).job.findFirst({
            where,
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true } as any,
        }).catch(() => null);

        if (!job) {
            throw new Error('No job found for this node');
        }

        // 复用你们现有 retry 语义：这里采取最安全策略：创建一条审计 + 调用 job retry endpoint 的内部逻辑不在此实现
        // 如果你们已有 JobService.retryJob(id)，请在 controller 里注入并调用。
        await this.writeAudit(projectId, actorId, 'PIPELINE_NODE_RETRY', { nodeId, jobId: job.id, reason });

        return { ok: true, jobId: job.id };
    }

    async skipNode(projectId: string, nodeId: string, actorId: string, reason: string) {
        if (!reason || reason.trim().length < 3) {
            throw new Error('Reason is required');
        }
        await this.writeAudit(projectId, actorId, 'PIPELINE_NODE_SKIP', { nodeId, reason });
        // ✅ 最小化：不改结构树持久化字段（避免影响生成链）
        // “跳过”的结果体现在审计日志与后续 gate 逻辑（下一阶段再接入）
        return { ok: true };
    }

    async forcePassNode(projectId: string, nodeId: string, actorId: string, reason: string) {
        if (!reason || reason.trim().length < 3) {
            throw new Error('Reason is required');
        }
        await this.writeAudit(projectId, actorId, 'PIPELINE_NODE_FORCE_PASS', { nodeId, reason });
        // ✅ 最小化：同 skip，不直接改结构树（避免破坏 gate 数据一致性）
        return { ok: true };
    }

    private parseNodeId(nodeId: string): { type: PipelineNodeType; refId: string } {
        const [t, id] = String(nodeId).split(':');
        const type = (t || '').toUpperCase() as PipelineNodeType;
        const refId = id || '';
        if (!refId) throw new Error('Invalid nodeId');
        if (!['PROJECT', 'SEASON', 'EPISODE', 'SCENE', 'SHOT'].includes(type)) throw new Error('Invalid node type');
        return { type, refId };
    }

    private async writeAudit(projectId: string, actorId: string, action: string, payload: any) {
        // 若你们已有 AuditLog 表：按实际字段名调整
        // 最安全：存在则写；不存在不阻断（但会 console.error），避免上线被 schema 卡死
        try {
            await (this.prisma as any).auditLog.create({
                data: {
                    projectId,
                    actorId,
                    action,
                    payload,
                    traceId: payload?.traceId || null,
                    createdAt: new Date(),
                },
            });
        } catch (e) {
            // 不影响主流程，但必须可见
            // eslint-disable-next-line no-console
            console.error('[AUDIT_WRITE_FAILED]', e);
        }
    }
}
