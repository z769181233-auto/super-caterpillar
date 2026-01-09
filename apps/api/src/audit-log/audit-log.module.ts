import { Module, forwardRef } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { HmacAuthModule } from '../auth/hmac/hmac-auth.module';

@Module({
  imports: [PrismaModule, forwardRef(() => HmacAuthModule)],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
