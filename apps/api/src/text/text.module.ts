import { Module } from '@nestjs/common';
import { TextController } from './text.controller';
import { TextService } from './text.service';
import { TextSafetyService } from './text-safety.service';
import { JobModule } from '../job/job.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { QualityModule } from '../quality/quality.module';
import { PermissionModule } from '../permission/permission.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    JobModule,
    PrismaModule,
    AuditLogModule,
    QualityModule,
    PermissionModule,
    ApiSecurityModule,
    AuthModule,
  ],
  controllers: [TextController],
  providers: [TextService, TextSafetyService],
  exports: [TextService, TextSafetyService],
})
export class TextModule {}
