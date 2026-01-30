import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsMetricsService } from './ops-metrics.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionModule } from '../permission/permission.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';

@Module({
  imports: [PrismaModule, AuthModule, PermissionModule, ApiSecurityModule],
  controllers: [OpsController],
  providers: [OpsMetricsService],
  exports: [OpsMetricsService],
})
export class OpsModule {}
