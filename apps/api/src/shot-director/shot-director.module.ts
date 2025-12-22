import { Module } from '@nestjs/common';
import { ShotDirectorController } from './shot-director.controller';
import { ShotDirectorService } from './shot-director.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [PrismaModule, AuditLogModule, AuthModule, ApiSecurityModule, PermissionModule],
  controllers: [ShotDirectorController],
  providers: [ShotDirectorService],
  exports: [ShotDirectorService],
})
export class ShotDirectorModule {}

