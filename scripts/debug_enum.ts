
import { PrismaClient } from '../packages/database/src/generated/prisma';
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Querying enum organization_role values...');
        const result = await prisma.$queryRaw`SELECT unnest(enum_range(NULL::organization_role)) as value`;
        console.log('Valid OrganizationRole values:', result);
    } catch (e) {
        console.error('Error querying enum:', e);
        // Try querying public.user_role explicitly if schema needed
    } finally {
        await prisma.$disconnect();
    }
}

main();
