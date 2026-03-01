import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [PrismaModule, AuditLogModule, AuthModule, ApiSecurityModule, PermissionModule],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
