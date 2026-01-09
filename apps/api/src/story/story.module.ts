import { Module } from '@nestjs/common';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';
import { JobModule } from '../job/job.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PermissionModule } from '../permission/permission.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    JobModule,
    PrismaModule,
    AuditLogModule,
    PermissionModule,
    ApiSecurityModule,
    AuthModule,
  ],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}
