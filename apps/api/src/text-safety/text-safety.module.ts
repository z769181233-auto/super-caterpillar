import { Module } from '@nestjs/common';
import { TextSafetyService } from './text-safety.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuditLogModule, FeatureFlagModule, PrismaModule],
  providers: [TextSafetyService],
  exports: [TextSafetyService],
})
export class TextSafetyModule { }

