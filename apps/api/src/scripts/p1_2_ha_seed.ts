// apps/api/src/scripts/p1_2_ha_seed.ts
import { PrismaClient } from "database";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

function env(name: string, def?: string) {
    const v = process.env[name] ?? def;
    if (v === undefined) throw new Error(`Missing env: ${name}`);
    return v;
}

async function main() {
    // 用于 gate 证据目录(可选)
    const evidDir = process.env.EVID_DIR ?? "";

    // 1) 找一个"活跃"的 worker（5 分钟内有心跳）
    const threshold = new Date(Date.now() - 5 * 60 * 1000);
    const worker = await prisma.workerNode.findFirst({
        where: {
            lastHeartbeat: { gte: threshold },
            status: { not: 'offline' },
        },
        orderBy: { lastHeartbeat: 'desc' },
        select: { id: true, workerId: true, lastHeartbeat: true },
    });

    if (!worker) {
        throw new Error(
            `No alive worker found (lastHeartbeat > now-300s). Start at least one worker before running gate.`
        );
    }

    const killWorkerId = worker.workerId;

    // 2) 找 PID: 优先 PID file,其次 grep
    function readPidFileMaybe(wid: string): { pid: string; hit: string } {
        const explicitFile = process.env.WORKER_PID_FILE;
        const explicitDir = process.env.WORKER_PID_DIR;

        // 注意:seed 可能从 repo 根目录运行,也可能从 apps/api 目录运行
        // 所以同时支持:基于 cwd 的"repo 常见路径",以及基于 __dirname 的"稳定路径"
        const candidates: string[] = [];

        if (explicitFile) candidates.push(explicitFile);
        if (explicitDir) candidates.push(path.join(explicitDir, `${wid}.pid`));

        // 基于 cwd 的常见 repo 路径
        candidates.push(path.resolve(process.cwd(), "apps/workers/.runtime/pids", `${wid}.pid`));
        candidates.push(path.resolve(process.cwd(), "../workers/.runtime/pids", `${wid}.pid`));
        candidates.push(path.resolve(process.cwd(), "../apps/workers/.runtime/pids", `${wid}.pid`));

        // 基于脚本位置的稳定路径:apps/api/src/scripts -> ../../../workers/.runtime/pids
        candidates.push(path.resolve(__dirname, "../../../workers/.runtime/pids", `${wid}.pid`));
        candidates.push(path.resolve(__dirname, "../../../../apps/workers/.runtime/pids", `${wid}.pid`));

        for (const file of candidates) {
            try {
                const pid = fs.readFileSync(file, "utf8").trim();
                if (/^\d+$/.test(pid)) return { pid, hit: file };
            } catch {
                // ignore
            }
        }
        return { pid: "", hit: "" };
    }

    const pidRes = readPidFileMaybe(killWorkerId);
    let killPid = pidRes.pid;
    if (killPid) {
        console.log(`PIDFILE_HIT=${pidRes.hit}`);
    }

    if (!killPid) {
        const pidGrep = process.env.WORKER_PID_GREP ?? `--workerId=${killWorkerId}`;
        try {
            const cmd = `ps -ef | grep "${pidGrep}" | grep -v grep | head -1 | awk '{print $2}'`;
            killPid = execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
        } catch {
            // ignore
        }
    }

    if (!killPid) {
        throw new Error(
            `Cannot locate worker PID. ` +
            `Tried PID file (WORKER_PID_FILE/WORKER_PID_DIR or ../workers/.runtime/pids/${killWorkerId}.pid) ` +
            `and WORKER_PID_GREP fallback. Ensure worker writes pid file or set WORKER_PID_FILE.`
        );
    }

    // 3) 解析 organizationId (shotJob 现在要求必填 organization)
    async function resolveOrgId(): Promise<string> {
        // a) 若已有 project 带 organizationId,优先使用
        const p = await prisma.project.findFirst({
            orderBy: { createdAt: "desc" },
            select: { id: true, organizationId: true },
        });
        if (p?.organizationId) return p.organizationId;

        // b) 找一个现存 organization
        const org = await (prisma as any).organization?.findFirst?.({
            orderBy: { createdAt: "desc" },
            select: { id: true },
        });
        if (org?.id) return org.id;

        // c) 没有就创建一个最小 organization
        const created = await (prisma as any).organization.create({
            data: {
                name: `p1_2_ha_org_${Date.now()}`,
                slug: `p1-2-ha-${Date.now()}`,
            } as any,
            select: { id: true },
        });
        return created.id as string;
    }

    const orgId = await resolveOrgId();

    // 4) 创建/复用一个 project(最小化:用已有 project,避免 schema 易碎)
    const project =
        (await prisma.project.findFirst({
            orderBy: { createdAt: "desc" },
            select: { id: true, organizationId: true },
        })) ??
        (await prisma.project.create({
            data: {
                name: `p1_2_ha_${Date.now()}`,
                // project 若有 organization 约束,则显式绑定
                organization: { connect: { id: orgId } } as any,
            } as any,
            select: { id: true, organizationId: true },
        }));

    const projectOrgId = (project as any).organizationId ?? orgId;

    // 5) 创建一个可 reclaim 的 RUNNING job
    const leaseSec = Number(process.env.P1_2_HA_LEASE_SEC ?? "120");

    // 关键:制造"已过期 lease"的 RUNNING job,kill 后 recovery 才会立即 reclaim
    const leaseUntil = new Date(Date.now() - 5 * 1000);

    // 4.1) 先确保 shotJob 所需的必填关系 episode 存在(required relation)
    // 优先复用最新 episode;没有则创建最小 season + episode(最稳、最少假设)
    let episodeId = "";

    const existingEpisode = await (prisma as any).episode?.findFirst?.({
        orderBy: { id: "desc" }, // ✅ schema 无 createdAt，用 id 做最新近似最稳
        select: { id: true },
    });

    if (existingEpisode?.id) {
        episodeId = existingEpisode.id;
    } else {
        // 没有 episode:创建最小 season + episode
        const season = await (prisma as any).season.create({
            data: {
                projectId: project.id,
                index: 1,
                name: `p1_2_ha_season_${Date.now()}`,
                organization: { connect: { id: projectOrgId } } as any,
            } as any,
            select: { id: true },
        });

        const episode = await (prisma as any).episode.create({
            data: {
                seasonId: season.id,
                index: 1,
                name: `p1_2_ha_episode_${Date.now()}`,
                organization: { connect: { id: projectOrgId } } as any,
            } as any,
            select: { id: true },
        });

        episodeId = episode.id;
    }

    if (!episodeId) {
        throw new Error("Failed to resolve episodeId for shotJob.create()");
    }

    // 5.1) 解析/创建 scene (shotJob 现在要求必填 scene)
    async function resolveSceneId(): Promise<string> {
        // a) 优先复用已有 scene
        const existing = await (prisma as any).scene?.findFirst?.({
            orderBy: { id: "desc" },
            select: { id: true },
        });

        if (existing?.id) return existing.id as string;

        // b) 没有 scene:创建一个"最小可用"的 scene
        const created = await (prisma as any).scene.create({
            data: {
                name: `p1_2_ha_scene_${Date.now()}`,
                index: 1,

                // 常见必需关系:project / episode / organization
                project: { connect: { id: project.id } },
                episode: { connect: { id: episodeId } },
                organization: { connect: { id: projectOrgId } },

                // 兼容标量字段
                projectId: project.id,
                episodeId,
                organizationId: projectOrgId,
            } as any,
            select: { id: true },
        });

        return created.id as string;
    }

    const sceneId = await resolveSceneId();
    if (!sceneId) throw new Error("Failed to resolve sceneId for shotJob.create()");

    // 5.15) 解析/创建 shot (shotJob 必填关系 - 最后一个)
    async function resolveShotId(): Promise<string> {
        // a) 优先复用已有 shot
        const existing = await (prisma as any).shot?.findFirst?.({
            orderBy: { id: "desc" },
            select: { id: true },
        });
        if (existing?.id) return existing.id as string;

        // b) 没有 shot: 创建一个最小可用的 shot
        const created = await (prisma as any).shot.create({
            data: {
                name: `p1_2_ha_shot_${Date.now()}`,
                index: 1,
                scene: { connect: { id: sceneId } },
                project: { connect: { id: project.id } },
                organization: { connect: { id: projectOrgId } },

                // 兼容 schema 的常见标量字段
                sceneId,
                projectId: project.id,
                organizationId: projectOrgId,
            } as any,
            select: { id: true },
        });

        return created.id as string;
    }

    const shotId = await resolveShotId();
    if (!shotId) throw new Error("Failed to resolve shotId for shotJob.create()");

    // 5.16) 可选连接 worker (不阻断seed,找到就连)
    async function resolveWorkerNodeIdByWorkerId(wid: string): Promise<string | null> {
        try {
            const found = await prisma.workerNode.findFirst({
                where: {
                    OR: [
                        { workerId: wid },
                        { name: wid },
                        { id: wid },
                    ],
                },
                select: { id: true },
            });
            return found?.id ?? null;
        } catch {
            return null;
        }
    }

    const workerNodeId = await resolveWorkerNodeIdByWorkerId(killWorkerId);

    // 5.2) 创建可回收的 RUNNING job
    const job = await prisma.shotJob.create({
        data: {
            // ✅ 必填关系:project (checked create 不允许直接写 projectId)
            project: { connect: { id: project.id } } as any,

            status: "RUNNING",
            lockedBy: killWorkerId,
            // ✅ workerId 字段不存在于schema,已删除
            // ✅ 可选连接worker关系(找到就连,不阻断seed)
            ...(workerNodeId ? { worker: { connect: { id: workerNodeId } } } : {}),

            leaseUntil,
            attempts: 1,

            type: "CE03_VISUAL_DENSITY" as any,
            // ✅ 移除engineKey/engineVersion - 让JobService自动处理engine绑定
            payload: {} as any,
            traceId: `p1_2_ha_${Date.now()}`,

            // ✅ required relation: episode / organization / scene / shot (all required relations)
            episode: { connect: { id: episodeId } } as any,
            organization: { connect: { id: projectOrgId } } as any,
            scene: { connect: { id: sceneId } } as any,
            shot: { connect: { id: shotId } } as any,
        } as any,
        // ✅ 这里依然可以 select projectId (读出来没问题)
        select: { id: true, projectId: true },
    });

    // 输出给 gate
    console.log(`PROJECT_ID=${job.projectId}`);
    console.log(`TEST_JOB_ID=${job.id}`);
    console.log(`KILL_WORKER_ID=${killWorkerId}`);
    console.log(`KILL_WORKER_PID=${killPid}`);
}

main()
    .catch((e) => {
        console.error(String(e?.stack ?? e));
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
