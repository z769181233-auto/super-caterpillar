/**
 * Signed URL 刷新接口实现
 * 
 * 添加到 StorageController 或创建新的 SignedUrlController
 */

import { Controller, Post, Body, UseGuards, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { StorageAuthService } from '../storage/storage-auth.service';
import { AuditLogService } from '../audit-log/audit-log.service';

export class RefreshSignedUrlDto {
    storageKey: string;
}

export class RefreshSignedUrlResponseDto {
    signedUrl: string;
    expiresAt: string; // ISO 8601
}

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageSignedUrlController {
    constructor(
        private readonly storageAuthService: StorageAuthService,
        private readonly signedUrlService: any, // 替换为实际的 SignedUrlService
        private readonly auditLogService: AuditLogService,
    ) { }

    /**
     * POST /api/storage/refresh-signed-url
     * 刷新签名 URL
     */
    @Post('refresh-signed-url')
    async refreshSignedUrl(
        @Body() dto: RefreshSignedUrlDto,
        @CurrentUser() user: any,
        @CurrentOrganization() organizationId: string,
    ): Promise<RefreshSignedUrlResponseDto> {
        const { storageKey } = dto;

        // 1. 权限校验：验证用户是否有权访问该 storageKey
        try {
            await this.storageAuthService.verifyAccess(
                storageKey,
                organizationId,
                user.id
            );
        } catch (error) {
            throw new UnauthorizedException('No permission to access this resource');
        }

        // 2. 生成签名 URL
        const ttlMinutes = parseInt(process.env.SIGNED_URL_TTL_MINUTES || '10', 10);
        const { url, expiresAt } = await this.signedUrlService.generate(
            storageKey,
            organizationId,
            user.id,
            ttlMinutes
        );

        // 3. 写审计日志
        await this.auditLogService.record({
            userId: user.id,
            orgId: organizationId,
            action: 'SIGNED_URL_REFRESH',
            resourceType: 'asset',
            resourceId: storageKey,
            details: {
                storageKey,
                expiresAt: expiresAt.toISOString(),
            },
        });

        return {
            signedUrl: url,
            expiresAt: expiresAt.toISOString(),
        };
    }
}
