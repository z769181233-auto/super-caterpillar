import { AudioService } from '../../apps/api/src/audio/audio.service';
import { PrismaClient } from 'database';
import * as crypto from 'crypto';

async function test() {
  const prisma = new PrismaClient({});
  const svc = new AudioService();

  const projectId = `test_p18_2_${Date.now()}`;
  const orgId = `org_p18_2`;
  const userId = `user_p18_2`;

  console.log(`[TEST] Creating project ${projectId}`);

  // Seed
  await prisma.user.create({
    data: { id: userId, email: `${userId}@test.com`, passwordHash: 'hash' },
  });
  await prisma.organization.create({ data: { id: orgId, name: 'Test Org', ownerId: userId } });
  await prisma.project.create({
    data: {
      id: projectId,
      name: 'P18-2 Real Routing Test',
      organizationId: orgId,
      ownerId: userId,
      settingsJson: { audioRealEnabled: false },
    },
  });

  try {
    // CASE T1: Kill Switch ON (Silence)
    process.env.AUDIO_REAL_FORCE_DISABLE = '1';
    process.env.AUDIO_VENDOR_API_KEY = 'valid_key';
    console.log('\nCASE T1: KS=1 (Strict Silence)');
    const resT1 = await svc.generateAndMix({
      text: 'Hello Silence',
      projectSettings: await svc.resolveProjectSettings(prisma, projectId),
    });
    console.log(
      `Mode: ${resT1.signals.audio_mode}, Vendor: ${resT1.signals.audio_vendor || 'SILENT'}`
    );
    if (resT1.signals.audio_vendor) throw new Error('KS silence violation: vendor signal present');
    if (resT1.signals.audio_mode !== 'legacy') throw new Error('KS fail');

    // CASE T2: Kill Switch OFF, Whitelist OFF (Stub)
    process.env.AUDIO_REAL_FORCE_DISABLE = '0';
    console.log('\nCASE T2: KS=0, Whitelist=0 (Stub)');
    const resT2 = await svc.generateAndMix({
      text: 'Hello Stub',
      projectSettings: await svc.resolveProjectSettings(prisma, projectId),
    });
    console.log(`Mode: ${resT2.signals.audio_mode}, Provider: ${resT2.signals.provider}`);
    if (resT2.signals.provider !== 'stub_wav_v1') throw new Error('Whitelist OFF fail');

    // CASE T3: Kill Switch OFF, Whitelist ON, API Key OK (Real)
    await prisma.project.update({
      where: { id: projectId },
      data: { settingsJson: { audioRealEnabled: true } },
    });
    console.log('\nCASE T3: KS=0, Whitelist=1, API_KEY=OK (Real)');
    const resT3 = await svc.generateAndMix({
      text: 'Hello Real',
      projectSettings: await svc.resolveProjectSettings(prisma, projectId),
    });
    console.log(
      `Mode: ${resT3.signals.audio_mode}, Vendor: ${resT3.signals.audio_vendor}, RequestID: ${resT3.signals.audio_vendor_request_id}`
    );
    if (resT3.signals.audio_mode !== 'real') throw new Error('Whitelist ON fail');
    if (!resT3.signals.audio_vendor_request_id) throw new Error('Missing request_id');

    // CASE T4: Whitelist ON, NO API Key (Fail-Fast)
    delete process.env.AUDIO_VENDOR_API_KEY;
    console.log('\nCASE T4: KS=0, Whitelist=1, API_KEY=MISSING (Fail-Fast)');
    try {
      await svc.generateAndMix({
        text: 'Hello Fail',
        projectSettings: await svc.resolveProjectSettings(prisma, projectId),
      });
      throw new Error('Case T4 should have failed');
    } catch (e: any) {
      console.log(`Caught expected error: ${e.message}`);
      if (e.message !== 'AUDIO_VENDOR_API_KEY_NOT_CONFIGURED')
        throw new Error('Wrong error message');

      // P18-2-HARD: Evidence of Error
      console.log(`ERROR_PROPAGATION: ${e.message}`);
    }

    console.log('\n[PASS] All P18-2 provider cases verified.');
  } finally {
    await prisma.project.delete({ where: { id: projectId } });
    await prisma.organization.delete({ where: { id: orgId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  }
}

test().catch((e) => {
  console.error(e);
  process.exit(1);
});
