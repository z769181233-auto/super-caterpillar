
import { PrismaClient } from '../packages/database';

async function main() {
    const prisma = new PrismaClient();
    try {
        await prisma.apiKey.update({
            where: { key: 'dev-worker-key' },
            data: { ownerOrgId: null }
        });
        console.log("ApiKey ownerOrgId unset.");
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
