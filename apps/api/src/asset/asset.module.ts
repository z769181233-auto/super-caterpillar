import { Module } from '@nestjs/common';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { PermissionModule } from '../permission/permission.module';

import { AssetDeliveryController } from './asset-delivery.controller';

@Module({
  imports: [PrismaModule, AuditLogModule, AuthModule, ApiSecurityModule, PermissionModule],
  controllers: [AssetController, AssetDeliveryController],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule { }
