import { Module } from '@nestjs/common';
import { EngineProfileController } from './engine-profile.controller';
import { EngineProfileService } from './engine-profile.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JobModule } from '../job/job.module';
import { EngineHubModule } from '../engine-hub/engine-hub.module';
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
    EngineHubModule,
    AuthModule, // Required for JwtOrHmacGuard
    ApiSecurityModule, // Required for JwtOrHmacGuard (needs ApiSecurityGuard)
  ],
  controllers: [EngineProfileController],
  providers: [EngineProfileService],
  exports: [EngineProfileService],
})
export class EngineProfileModule {}
