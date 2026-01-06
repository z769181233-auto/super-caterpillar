
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { OrganizationService } from './organization/organization.service';
import bcrypt from 'bcryptjs';
import { UserType, UserRole } from 'database';

async function createTestUser() {
    console.log('🚀 Creating Test User for Frontend Verification...');
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const prisma = app.get(PrismaService);
    const orgService = app.get(OrganizationService);

    const email = 'admin@example.com';
    const password = 'password123';
    // Use verify-ready hash
    const passwordHash = await bcrypt.hash(password, 10);

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                userType: 'individual',
                role: UserRole.admin, // Force Admin Role
                tier: 'Pro',
                quota: {
                    remainingTokens: 10000,
                    computeSeconds: 10000,
                    credits: 1000,
                }
            }
        });
        console.log(`✅ Created user: ${email} / ${password} (ID: ${user.id})`);
    } else {
        console.log(`ℹ️ User already exists: ${email}. Resetting password...`);
        user = await prisma.user.update({
            where: { email },
            data: {
                passwordHash,
                userType: UserType.individual,
                role: UserRole.admin // Force Admin Role update
            }
        });
        console.log(`✅ Password reset to: ${password}`);
    }

    // Ensure Organization
    const orgId = await orgService.getCurrentOrganization(user.id);
    console.log(`✅ Organization ensured: ${orgId}`);

    // Ensure Role and Permissions (RBAC)
    // 1. Ensure Permissions exist
    const permissions = ['auth', 'project.create'];
    for (const key of permissions) {
        let perm = await prisma.permission.findUnique({ where: { key } });
        if (!perm) {
            perm = await prisma.permission.create({
                data: { key, scope: 'system' }
            });
            console.log(`✅ Permission ensured: ${key}`);
        }
    }

    // 2. Ensure Role 'admin' exists
    let role = await prisma.role.findUnique({ where: { name: 'admin' } });
    if (!role) {
        role = await prisma.role.create({
            data: { name: 'admin', level: 100 }
        });
        console.log(`✅ Role ensured: admin`);
    }

    // 3. Assign Permissions to Role
    for (const key of permissions) {
        const perm = await prisma.permission.findUnique({ where: { key } });
        // Use non-null assertion as we just ensured it
        const permId = perm!.id;

        const exists = await prisma.rolePermission.findUnique({
            where: { roleId_permissionId: { roleId: role.id, permissionId: permId } }
        });
        if (!exists) {
            await prisma.rolePermission.create({
                data: { roleId: role.id, permissionId: permId }
            });
            console.log(`✅ Assigned ${key} to admin`);
        }
    }

    await app.close();
}

createTestUser();
