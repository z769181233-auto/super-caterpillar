
import { PrismaClient } from 'database';

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log('Attempting to create VIDEO_RENDER task...');
        // We probably can't create real task because of foreign keys (Project/Org),
        // but the validation happens BEFORE DB write usually.
        // Actually, we can use a raw query or try create with invalid IDs and expect FK error, 
        // NOT validation error.

        await prisma.task.create({
            data: {
                id: 'debug-task-001',
                organizationId: '00000000-0000-0000-0000-000000000000', // Dummy
                projectId: '00000000-0000-0000-0000-000000000000', // Dummy
                type: 'VIDEO_RENDER' as any,
                // Cast to any to check Runtime Validation. 
                // If TS compiles, then Static check passed. 
                // We want to see if Runtime Client throws.
                status: 'PENDING',
                payload: {}
            }
        });
        console.log('Success! (Or at least passed validation)');
    } catch (e: any) {
        console.error('Caught error:');
        console.error(e.message);
        if (e.code) console.error('Code:', e.code);
    } finally {
        await prisma.$disconnect();
    }
}

main();
