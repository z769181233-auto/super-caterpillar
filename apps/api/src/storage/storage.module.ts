
import { Module, Global, forwardRef } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { StorageController } from './storage.controller';
import { SignedUrlService } from './signed-url.service';
import { StorageAuthService } from './storage-auth.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';

@Global()
@Module({
    imports: [
        PrismaModule,
        // 确保 StorageModule 能解析与 auth 相关的 provider/guard（包括 JwtOrHmacGuard）
        AuthModule,
        AuditLogModule,
    ],
    controllers: [StorageController],
    providers: [
        LocalStorageService,
        SignedUrlService,
        StorageAuthService,
    ],
    exports: [LocalStorageService, SignedUrlService, StorageAuthService],
})
export class StorageModule { }
