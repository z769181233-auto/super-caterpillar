import { Module } from '@nestjs/common';
import { EngineAdminController } from './engine-admin.controller';
import { EngineAdminService } from './engine-admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionModule } from '../permission/permission.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, PermissionModule, AuthModule],
  controllers: [EngineAdminController],
  providers: [EngineAdminService],
  exports: [EngineAdminService], // S3-C.1: 导出以在 EngineController 中使用
})
export class EngineAdminModule { }

