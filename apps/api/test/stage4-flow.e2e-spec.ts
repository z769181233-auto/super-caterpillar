import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import * as util from "util";

describe('Stage 4 Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let authToken: string;
  let userId: string;
  let org: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    // Ensure global prefix matches production
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // 1. Setup Test User (Admin) & Organization
    const email = `e2e-stage4-${Date.now()}@test.com`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'mock_hash',
        role: 'admin',
        userType: 'individual',
      },
    });
    userId = user.id;

    // Create Organization for context
    org = await prisma.organization.create({
      data: {
        name: 'E2E Org',
        ownerId: user.id,
      },
    });

    // Link User to Org
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER',
      },
    });

    // Update User default org
    await prisma.user.update({
      where: { id: user.id },
      data: { defaultOrganizationId: org.id },
    });

    // 1.5. Seed Admin Permissions (CRITICAL for E2E Test DB Isolation)
    // Ensure 'admin' role has 'project.create' and 'auth'
    const sysPerms = ['auth', 'project.create'];

    // Ensure perms exist
    for (const key of sysPerms) {
      await prisma.permission.upsert({
        where: { key },
        create: { key, scope: 'system' },
        update: { scope: 'system' },
      });
    }

    // Ensure 'admin' role exists
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      create: { name: 'admin', level: 100 },
      update: {},
    });

    // Ensure 'OWNER' role exists (for Project Membership)
    const ownerRole = await prisma.role.upsert({
      where: { name: 'OWNER' },
      create: { name: 'OWNER', level: 100 },
      update: {},
    });

    // Assign system perms to admin
    for (const key of sysPerms) {
      const p = await prisma.permission.findUnique({ where: { key } });
      if (p) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: adminRole.id, permissionId: p.id },
          },
          create: { roleId: adminRole.id, permissionId: p.id },
          update: {},
        });
      }
    }

    // Seed Project Permissions and Assign to OWNER
    const projPerms = [
      'project.read',
      'project.write',
      'project.generate',
      'project.review',
      'project.publish',
      'project.delete',
    ];

    for (const key of projPerms) {
      const p = await prisma.permission.upsert({
        where: { key },
        create: { key, scope: 'project' },
        update: { scope: 'project' },
      });

      // Assign to OWNER
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: ownerRole.id, permissionId: p.id },
        },
        create: { roleId: ownerRole.id, permissionId: p.id },
        update: {},
      });
      // Also Assign to ADMIN? (If we want Admin to have project scope perms?
      // But Admin is not member. So getProjectPerms won't pick it up anyway unless logic changes.
      // But for safety, assign it.)
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: adminRole.id, permissionId: p.id },
        },
        create: { roleId: adminRole.id, permissionId: p.id },
        update: {},
      });
    }

    // 2. Generate Token directly
    // We need to match the payload structure used by AuthService
    const payload = { sub: user.id, email: user.email, role: user.role, orgId: org.id };
    authToken = jwtService.sign(payload, { secret: process.env.JWT_SECRET || 'secret' });
  });

  afterAll(async () => {
    // Cleanup
    if (userId) {
      // Optional: db teardown
      await prisma.user
        .delete({ where: { id: userId } })
        .catch((e) => process.stdout.write(util.format('Failed to cleanup user', e) + "\n"));
      // Deleting user usually cascades to org/memberships if cascade delete is set up,
      // but manual cleanup of org might be safer if not.
      if (org) {
        await prisma.organization
          .delete({ where: { id: org.id } })
          .catch((e) => process.stdout.write(util.format('Failed to cleanup org', org.id) + "\n"));
      }
    }
    await app.close();
  });

  it('should execute Stage 4 flow successfully', async () => {
    // 1. Create Project
    const createProjectRes = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      // Ensure context is passed
      .set('x-organization-id', org.id)
      .send({
        name: 'E2E Stage 4 Project',
        description: 'Generated by E2E test',
      })
      .expect(201);

    const projectId = createProjectRes.body.data.id;
    expect(projectId).toBeDefined();

    // Register for cleanup
    try {
      // 1.5 Manually Ensure Membership (in case ProjectService didn't link RBAC correctly)
      // Find OWNER role
      const ownerRole = await prisma.role.findUnique({ where: { name: 'OWNER' } });
      if (ownerRole) {
        await prisma.projectMember.upsert({
          where: {
            userId_projectId: { userId, projectId },
          },
          create: {
            userId,
            projectId,
            roleId: ownerRole.id,
          },
          update: {
            roleId: ownerRole.id,
          },
        });
      }

      // 2. Create Episode (Structure)
      const createEpisodeRes = await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/episodes`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', org.id)
        .send({ name: 'E2E Episode', index: 1 })
        .expect(201);

      const episodeId = createEpisodeRes.body.data.id;
      expect(episodeId).toBeDefined();

      // 3. Create Scene
      const createSceneRes = await request(app.getHttpServer())
        .post(`/api/projects/episodes/${episodeId}/scenes`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', org.id)
        .send({ title: 'E2E Scene', index: 1, summary: 'Test scene' })
        .expect(201);

      const sceneId = createSceneRes.body.data.id;
      expect(sceneId).toBeDefined();

      // 4. Trigger Semantic Enhancement (The Step that failed before)
      // Using the simplified route we configured
      process.stdout.write(util.format('Triggering Semantic Enhancement (this may take time due to LLM)...') + "\n");
      const semanticRes = await request(app.getHttpServer())
        .post(`/api/stage4/projects/${projectId}/scenes/${sceneId}/semantic-enhancement`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', org.id)
        .send({})
        .expect(201);

      expect(semanticRes.body.success).toBe(true);
      expect(semanticRes.body.data).toBeDefined();
      // Check for mock data
      expect(semanticRes.body.data.summary).toBeDefined();
      expect(semanticRes.body.data.keywords).toBeInstanceOf(Array);

      process.stdout.write(util.format('✅ Stage 4 E2E Test Passed!') + "\n");
    } finally {
      // Cleanup Project - Always delete the project to avoid pollution
      if (projectId) {
        await prisma.project
          .delete({ where: { id: projectId } })
          .catch((e) => process.stderr.write(util.format('Cleanup failed', e) + "\n"));
      }
    }
  }, 60000); // Increased timeout to 60s for LLM interactions
});
