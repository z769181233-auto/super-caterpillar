
import { AudioService } from '../../apps/api/src/audio/audio.service';
import { PrismaClient } from 'database';
import * as crypto from 'crypto';

async function test() {
    const prisma = new PrismaClient();
    const svc = new AudioService();

    const projectId = `test_p18_1_${Date.now()}`;
    const orgId = `org_p18_1`;
    const userId = `user_p18_1`;

    console.log(`[TEST] Creating project ${projectId}`);

    // Cleanup
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });

    await prisma.user.create({ data: { id: userId, email: `${userId}@test.com`, passwordHash: 'hash' } });
    await prisma.organization.create({ data: { id: orgId, name: 'Test Org', ownerId: userId } });

    await prisma.project.create({
        data: {
            id: projectId,
            name: 'P18-1 Routing Test',
            organizationId: orgId,
            ownerId: userId,
            settingsJson: { audioRealEnabled: false }
        }
    });

    try {
        // CASE 1: Kill Switch ON (Force Legacy)
        process.env.AUDIO_REAL_FORCE_DISABLE = '1';
        console.log("\nCASE A: KS=1");
        const resA = await svc.generateAndMix({
            text: "Hello KS",
            projectSettings: await svc.resolveProjectSettings(prisma, projectId)
        });
        console.log(`Mode: ${resA.signals.audio_mode}, KS: ${resA.signals.audio_kill_switch}`);
        if (resA.signals.audio_mode !== 'legacy') throw new Error("KS fail");

        // CASE 2: Kill Switch OFF, Whitelist OFF (Force Stub)
        process.env.AUDIO_REAL_FORCE_DISABLE = '0';
        console.log("\nCASE B: KS=0, Whitelist=0");
        const resB = await svc.generateAndMix({
            text: "Hello Stub",
            projectSettings: await svc.resolveProjectSettings(prisma, projectId)
        });
        console.log(`Mode: ${resB.signals.audio_mode}, KS: ${resB.signals.audio_kill_switch}`);
        if (resB.signals.audio_mode !== 'stub') throw new Error("Whitelist OFF fail");

        // CASE 3: Kill Switch OFF, Whitelist ON (Real Routing)
        await prisma.project.update({
            where: { id: projectId },
            data: { settingsJson: { audioRealEnabled: true } }
        });
        console.log("\nCASE C: KS=0, Whitelist=1");
        const resC = await svc.generateAndMix({
            text: "Hello Real",
            projectSettings: await svc.resolveProjectSettings(prisma, projectId)
        });
        console.log(`Mode: ${resC.signals.audio_mode}, KS: ${resC.signals.audio_kill_switch}`);
        // For P18-1, "real" mode with stub provider is expected if no real provider wired yet
        if (resC.signals.audio_mode !== 'real') throw new Error("Whitelist ON fail");

        console.log("\n[PASS] All routing cases verified.");
    } finally {
        await prisma.project.delete({ where: { id: projectId } });
        await prisma.$disconnect();
    }
}

test().catch(e => {
    console.error(e);
    process.exit(1);
});
