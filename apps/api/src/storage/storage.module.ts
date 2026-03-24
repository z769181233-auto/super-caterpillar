import { Module, Global } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageController } from './storage.controller';
import { LocalStorageService } from './local-storage.service';
import { SignedUrlService } from './signed-url.service';
import { StorageAuthService } from './storage-auth.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [StorageController],
  providers: [LocalStorageService, SignedUrlService, StorageAuthService],
  exports: [LocalStorageService, SignedUrlService, StorageAuthService],
})
export class StorageModule {}
