
import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error('Usage: tsx grant_permission.ts <email>');
        process.exit(1);
    }

    console.log(`Granting admin role to ${email}...`);

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.error(`User ${email} not found.`);
        process.exit(1);
    }

    // Update role to admin
    // Based on your schema: role UserRole @default(viewer)
    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'admin' },
    });

    console.log(`✅ Granted admin role to ${email}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
