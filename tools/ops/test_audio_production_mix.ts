import { AudioService } from '../../apps/api/src/audio/audio.service';
import { PrismaClient } from 'database';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { spawn } from 'child_process';

function getDuration(absPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      absPath,
    ]);
    let out = '';
    p.stdout.on('data', (d) => (out += d.toString()));
    p.on('close', () => resolve(parseFloat(out)));
    p.on('error', reject);
  });
}

async function test() {
  const prisma = new PrismaClient({});

  // Mock OpsMetricsService
  const mockMetrics = {
    incrementAudioPreview: () => {},
    incrementAudioVendorCall: () => {},
    incrementAudioCacheHit: () => {},
    incrementAudioCacheMiss: () => {},
  } as any;

  const svc = new AudioService(mockMetrics);

  const projectId = `test_p18_3_${Date.now()}`;
  const orgId = `org_p18_3`;
  const userId = `user_p18_3`;

  // Seed
  await prisma.user.create({
    data: { id: userId, email: `${userId}@test.com`, passwordHash: 'hash' },
  });
  await prisma.organization.create({ data: { id: orgId, name: 'Test Org', ownerId: userId } });
  await prisma.project.create({
    data: {
      id: projectId,
      name: 'P18-3 Production Mix Test',
      organizationId: orgId,
      ownerId: userId,
      settingsJson: { audioRealEnabled: true, audioBgmEnabled: true },
    },
  });

  try {
    process.env.AUDIO_REAL_FORCE_DISABLE = '0';
    process.env.AUDIO_VENDOR_API_KEY = 'valid_key';

    console.log('\n[TEST] Verifying Production Mix & Deterministic BGM');
    const res = await svc.generateAndMix({
      text: 'Voice track for mixing',
      bgmSeed: 'consistent_bgm_seed',
      projectSettings: await svc.resolveProjectSettings(prisma, projectId),
    });

    const voiceDur = await getDuration(res.voice.absPath);
    const mixedDur = await getDuration(res.mixed!.absPath);

    console.log(`Voice Duration: ${voiceDur.toFixed(3)}s`);
    console.log(`Mixed Duration: ${mixedDur.toFixed(3)}s`);

    // P18-3.3: Duration Alignment Assertion
    if (Math.abs(voiceDur - mixedDur) > 0.05) {
      throw new Error(`Duration alignment failed: voice=${voiceDur}, mixed=${mixedDur}`);
    }
    console.log('Duration Alignment: OK');

    // P18-3.0 Audit Signal Verification
    console.log('Audit Signals Check:');
    const s = res.signals;
    const required = ['mixer', 'mixed_audio_sha256', 'bgm_provider', 'bgm_sha256', 'mixer_params'];
    for (const f of required) {
      if (!s[f]) throw new Error(`Missing audit signal: ${f}`);
      console.log(`- ${f}: PRESENT`);
    }

    if (s.mixer_params.ducking !== 'sidechaincompress_v1') throw new Error('Wrong ducking param');
    if (s.mixer_params.fade !== 'afade_v1') throw new Error('Wrong fade param');

    console.log('\n[PASS] P18-3 Production Mix verified.');
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
