
import { PrismaClient } from '../packages/database';

async function main() {
    const prisma = new PrismaClient();
    try {
        const k = await prisma.apiKey.findUnique({ where: { key: 'dev-worker-key' } });
        console.log("Current Key Record:", JSON.stringify(k, null, 2));

        let needsUpdate = false;
        let updateData: any = {};

        if (!k?.ownerUserId) {
            const user = await prisma.user.findFirst();
            if (user) {
                updateData.ownerUserId = user.id;
                needsUpdate = true;
            }
        }
        if (!k?.ownerOrgId) {
            const org = await prisma.organization.findFirst();
            if (org) {
                updateData.ownerOrgId = org.id;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            await prisma.apiKey.update({
                where: { key: 'dev-worker-key' },
                data: updateData
            });
            console.log(`Updated ApiKey with:`, updateData);
        } else {
            console.log("ApiKey already has owner.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
