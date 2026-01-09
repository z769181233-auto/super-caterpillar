import { Module, Global } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';

/**
 * Feature Flag Module
 *
 * 设置为 @Global() 以便在整个应用中使用，无需重复导入
 */
@Global()
@Module({
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
