import { Module } from '@nestjs/common';
import { EngineProfileController } from './engine-profile.controller';
import { EngineProfileService } from './engine-profile.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JobModule } from '../job/job.module';
// Note: EngineModule is in engines/, but we need EngineRegistry and EngineConfigStoreService
// These are in engine/ directory, so we'll import them directly via a shared module
// For now, we'll import from engines/engine.module
import { EngineModule } from '../engines/engine.module';
import { AuthModule } from '../auth/auth.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';

/**
 * S4-A: 引擎画像模块
 * 
 * 提供引擎画像统计功能，只读服务
 */
@Module({
  imports: [
    PrismaModule,
    JobModule,
    EngineModule,
    AuthModule, // Required for JwtOrHmacGuard
    ApiSecurityModule, // Required for JwtOrHmacGuard (needs ApiSecurityGuard)
  ],
  controllers: [EngineProfileController],
  providers: [EngineProfileService],
  exports: [EngineProfileService],
})
export class EngineProfileModule {}

