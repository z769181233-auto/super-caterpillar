import { RedisService } from '../../apps/api/src/redis/redis.service';
import { AuditService } from '../../apps/api/src/audit/audit.service';
import { CostLedgerService } from '../../apps/api/src/cost/cost-ledger.service';
import { PrismaService } from '../../apps/api/src/prisma/prisma.service';
import { BillingService } from '../../apps/api/src/billing/billing.service';
import { PP01VideoStitchAdapter } from '../../apps/api/src/engines/adapters/pp01_video_stitch.adapter';
import { PP02SubtitleOverlayAdapter } from '../../apps/api/src/engines/adapters/pp02_subtitle_overlay.adapter';
import { PP03WatermarkAdapter } from '../../apps/api/src/engines/adapters/pp03_watermark.adapter';
import { PP04HLSPackageAdapter } from '../../apps/api/src/engines/adapters/pp04_hls_package.adapter';

async function main() {
    const prisma = new PrismaService();
    const redis = new RedisService();
    await redis.onModuleInit();
    const billing = new BillingService(prisma);
    const cost = new CostLedgerService(prisma, billing);
    const audit = new AuditService(prisma);

    const pp01 = new PP01VideoStitchAdapter(redis, audit, cost);
    const pp02 = new PP02SubtitleOverlayAdapter(redis, audit, cost);
    const pp03 = new PP03WatermarkAdapter(redis, audit, cost);
    const pp04 = new PP04HLSPackageAdapter(redis, audit, cost);

    const suffix = Math.random().toString(36).substring(7);
    const projectId = 'p3_pp_batch_test';
    const userId = 'system';
    const orgId = 'org1';

    // Seed
    await (prisma as any).user.upsert({ where: { id: userId }, update: {}, create: { id: userId, email: `pp_sys_${suffix}@scu`, passwordHash: 'mock' } });
    await (prisma as any).organization.upsert({ where: { id: orgId }, update: { credits: 2000 }, create: { id: orgId, name: 'PP Org', ownerId: userId, credits: 2000 } });
    await (prisma as any).project.upsert({ where: { id: projectId }, update: {}, create: { id: projectId, name: 'PP Batch Project', ownerId: userId, organizationId: orgId } });

    // PP01
    const j1 = `job_pp01_${suffix}`;
    await (prisma as any).shotJob.create({ data: { id: j1, projectId, status: 'RUNNING', type: 'PP_RENDER', attempts: 1, organizationId: orgId } });
    const r1 = await pp01.invoke({ jobType: 'PP_RENDER', engineKey: 'pp01_video_stitch', payload: {}, context: { projectId, userId, traceId: `t_pp01_${suffix}`, jobId: j1, organizationId: orgId } });
    console.log("PP01:", r1.output.assetUrl);

    // PP02
    const j2 = `job_pp02_${suffix}`;
    await (prisma as any).shotJob.create({ data: { id: j2, projectId, status: 'RUNNING', type: 'PP_RENDER', attempts: 1, organizationId: orgId } });
    const r2 = await pp02.invoke({ jobType: 'PP_RENDER', engineKey: 'pp02_subtitle_overlay', payload: { sourceUrl: r1.output.assetUrl }, context: { projectId, userId, traceId: `t_pp02_${suffix}`, jobId: j2, organizationId: orgId } });
    console.log("PP02:", r2.output.assetUrl);

    // PP03
    const j3 = `job_pp03_${suffix}`;
    await (prisma as any).shotJob.create({ data: { id: j3, projectId, status: 'RUNNING', type: 'PP_RENDER', attempts: 1, organizationId: orgId } });
    const r3 = await pp03.invoke({ jobType: 'PP_RENDER', engineKey: 'pp03_watermark', payload: { sourceUrl: r2.output.assetUrl }, context: { projectId, userId, traceId: `t_pp03_${suffix}`, jobId: j3, organizationId: orgId } });
    console.log("PP03:", r3.output.assetUrl);

    // PP04
    const j4 = `job_pp04_${suffix}`;
    await (prisma as any).shotJob.create({ data: { id: j4, projectId, status: 'RUNNING', type: 'PP_RENDER', attempts: 1, organizationId: orgId } });
    const r4 = await pp04.invoke({ jobType: 'PP_RENDER', engineKey: 'pp04_hls_package', payload: { sourceUrl: r3.output.assetUrl }, context: { projectId, userId, traceId: `t_pp04_${suffix}`, jobId: j4, organizationId: orgId } });
    console.log("PP04:", r4.output.assetUrl);

    process.exit(0);
}
main();
