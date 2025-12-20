
import { PrismaClient, UserRole } from 'database';

const prisma = new PrismaClient();

async function promote() {
    const email = 'admin@example.com';
    console.log(`🚀 Promoting user ${email} to admin...`);

    const user = await prisma.user.update({
        where: { email },
        data: { role: UserRole.admin },
    });

    console.log(`✅ User promoted: ${user.id} -> ${user.role}`);
}

promote()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
