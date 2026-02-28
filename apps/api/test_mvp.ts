import * as jwt from 'jsonwebtoken';
import { PrismaClient } from 'database';

const prisma = new PrismaClient();
const secret = process.env.JWT_SECRET || 'v1_scu_jwt_secret_998877665544332211_dev_only';

async function verifyAPI() {
    console.log('Fetching user...');
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found in DB');

    console.log(`Using user ${user.email} (ID: ${user.id})`);

    const payload = {
        sub: user.id,
        email: user.email,
        tier: user.tier,
        orgId: user.defaultOrganizationId,
    };
    const token = jwt.sign(payload, secret);
    console.log(`Generated JWT token...`);

    const buildId = 'bf67cbdc-79a9-42be-b074-6239a2719064';
    console.log(`Testing Outline API for ${buildId}...`);
    const outlineRes = await fetch(`http://localhost:3000/api/builds/${buildId}/outline`, {
        headers: { Authorization: `Bearer ${token}` }
    });

    const outlineData = await outlineRes.json();
    if (!outlineRes.ok) throw new Error(`Outline failed: ${JSON.stringify(outlineData)}`);
    console.log(`[Outline] Title: ${outlineData.build.title}`);
    console.log(`[Outline] Episodes: ${outlineData.stats.episodes}, Scenes: ${outlineData.stats.scenes}`);
    console.log(`[Outline] Words: ${Math.round(outlineData.stats.totalBytes / 2)}`);

    const firstShot = outlineData.episodes[0].scenes[0].shots[0];
    const shotId = firstShot.id;
    console.log(`\nTesting Shot Source API for ${shotId}...`);
    const sourceRes = await fetch(`http://localhost:3000/api/shots/${shotId}/source?context=200`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const sourceData = await sourceRes.json();
    if (!sourceRes.ok) throw new Error(`Source failed: ${JSON.stringify(sourceData)}`);

    console.log(`[Source] Summary: ${sourceData.shot.summary.substring(0, 50)}...`);
    console.log(`[Source] Excerpt Offset: ${sourceData.source.excerptStart} -> ${sourceData.source.excerptEnd}`);
    console.log(`[Source] Original Match Offset: ${sourceData.source.startOffset} -> ${sourceData.source.endOffset}`);
    console.log(`[Source] Text Excerpt Preview: \n"${sourceData.source.excerpt.substring(0, 200).replace(/\n/g, '\\n')}..."`);
    console.log(`\n--- ALL VISUALIZATION MVP APIs VERIFIED SUCCESSFULLY ---`);
}

verifyAPI().catch(console.error).finally(() => prisma.$disconnect());
