import { Module, Global } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Feature Flag Module
 *
 * 设置为 @Global() 以便在整个应用中使用，无需重复导入
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
