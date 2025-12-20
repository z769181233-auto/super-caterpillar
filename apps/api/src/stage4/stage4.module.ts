import { Module } from '@nestjs/common';
import { Stage4Controller } from './stage4.controller';
import { Stage4Service } from './stage4.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EngineHubModule } from '../engine-hub/engine-hub.module';
import { ProjectModule } from '../project/project.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [PrismaModule, EngineHubModule, ProjectModule, AuditLogModule, AuthModule, PermissionModule],
  controllers: [Stage4Controller],
  providers: [Stage4Service],
})
export class Stage4Module {}

