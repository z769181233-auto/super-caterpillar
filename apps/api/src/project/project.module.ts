import { Module, forwardRef } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectStructureController } from './project-structure.controller';
import { ProjectService } from './project.service';
import { ProjectStructureService } from './project-structure.service';
import { StructureGenerateService } from './structure-generate.service';
import { SceneGraphService } from './scene-graph.service';
import { SceneGraphCache } from './scene-graph.cache';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionModule } from '../permission/permission.module';
import { JobModule } from '../job/job.module';
import { TaskModule } from '../task/task.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuditModule } from '../audit/audit.module';
import { RedisModule } from '../redis/redis.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';

import { ProjectResolver } from '../common/project-resolver';

@Module({
  imports: [
    UserModule,
    PrismaModule,
    forwardRef(() => JobModule),
    PermissionModule,
    TaskModule,
    AuthModule,
    AuditLogModule,
    AuditModule,
    RedisModule,
    ApiSecurityModule,
  ],
  controllers: [ProjectController, ProjectStructureController],
  providers: [
    ProjectService,
    ProjectStructureService,
    StructureGenerateService,
    SceneGraphService,
    SceneGraphCache,
    ProjectResolver,
  ],
  exports: [
    ProjectService,
    ProjectStructureService,
    StructureGenerateService,
    SceneGraphService,
    ProjectResolver,
  ],
})
export class ProjectModule { }
