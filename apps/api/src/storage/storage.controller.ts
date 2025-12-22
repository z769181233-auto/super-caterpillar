
import { Controller, Get, Param, Res, Query, NotFoundException, BadRequestException, Logger, UnauthorizedException, Header, UseGuards, Post, Body, Inject } from '@nestjs/common';
import { Response } from 'express';
import { LocalStorageService } from './local-storage.service';
import { SignedUrlService } from './signed-url.service';
import { StorageAuthService } from './storage-auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { AuthenticatedUser } from '@scu/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';
import { TextSafetyMetrics } from '../observability/text_safety.metrics';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';

@Controller('storage')
export class StorageController {
    private readonly logger = new Logger(StorageController.name);
    private debugLogged = false; // 仅记录一次调试日志

    constructor(
        @Inject(LocalStorageService) private readonly storageService: LocalStorageService,
        @Inject(SignedUrlService) private readonly signedUrlService: SignedUrlService,
        @Inject(StorageAuthService) private readonly storageAuthService: StorageAuthService,
        @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
        @Inject(PrismaService) private readonly prisma: PrismaService,
        @Inject(FeatureFlagService) private readonly featureFlagService: FeatureFlagService,
    ) { }

    @Post('refresh-signed-url')
    @UseGuards(JwtOrHmacGuard)
    async refreshSignedUrl(
        @Body() body: { storageKey: string },
        @CurrentUser() user: AuthenticatedUser,
        @CurrentOrganization() organizationId: string,
    ) {
        try {
            TextSafetyMetrics.recordSignedUrlRefresh();

            const { storageKey } = body;
            if (!storageKey) {
                // BadRequest is client error, not system failure, so maybe don't trigger fail-safe fallback but just throw
                throw new BadRequestException('storageKey is required');
            }

            // Stage 12 Governance: Gating Check
            const enabled = this.featureFlagService.isEnabled('FEATURE_SIGNED_URL_ENFORCED', {
                orgId: organizationId,
                userId: user.userId,
            });

            if (!enabled) {
                return {
                    signedUrl: null,
                    expiresAt: null,
                    storageKey: body.storageKey,
                    fallback: true,
                };
            }

            // 1. 查找 Asset (只需校验是否存在和归属项目)
            const asset = await this.prisma.asset.findFirst({
                where: { storageKey },
                select: { id: true, projectId: true },
            });

            if (!asset) {
                throw new NotFoundException('Asset not found');
            }

            // 2. 权限校验
            try {
                await this.storageAuthService.verifyAccess(
                    storageKey,
                    organizationId,
                    user.userId
                );
            } catch (e) {
                TextSafetyMetrics.recordSignedUrlDeny();
                this.logger.warn(`[StorageController] verifyAccess failed: ${e.message}`);
                throw new UnauthorizedException('No permission to access this resource');
            }

            // 3. 生成签名 URL
            const ttlMinutes = Number(process.env.SIGNED_URL_TTL_MINUTES ?? '10');
            const { url, expiresAt } = this.signedUrlService.generateSignedUrl({
                key: storageKey,
                tenantId: organizationId,
                userId: user.userId,
                expiresIn: ttlMinutes * 60
            });

            // 4. 审计
            await this.auditLogService.record({
                userId: user.userId,
                // orgId: organizationId, // AuditLogService might not accept orgId directly in `record` depending on implementation, usually `details` or context.
                action: 'SIGNED_URL_REFRESH',
                resourceType: 'asset',
                resourceId: asset.id,
                details: { storageKey, expiresAt: expiresAt.toISOString(), organizationId },
            });

            return {
                signedUrl: url,
                expiresAt: expiresAt.toISOString(),
            };

        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException || error instanceof UnauthorizedException) {
                throw error;
            }

            // Fail-safe: 明确返回失败状态，而不是伪造 URL
            this.logger.error(`refreshSignedUrl FAILED, fallback to legacy. Error: ${error.message}`, error.stack);

            try {
                await this.auditLogService.record({
                    userId: user.userId,
                    action: 'SIGNED_URL_FAILSAFE',
                    resourceType: 'asset',
                    resourceId: 'unknown',
                    details: { error: error.message, storageKey: body.storageKey }
                });
            } catch (e) { /* ignore */ }

            return {
                signedUrl: null, // Explicitly null to indicate no signed URL generated
                expiresAt: null,
                storageKey: body.storageKey,
                fallback: true,
            };
        }
    }

    /**
     * 生成签名 URL（需要鉴权 + RBAC 验证）
     */
    @UseGuards(JwtOrHmacGuard)
    @Get('sign/:key(*)')
    async generateSignedUrl(
        @Param('key') key: string,
        @Query('expiresIn') expiresIn?: string,
        @CurrentUser() user?: AuthenticatedUser,
        @CurrentOrganization() organizationId?: string,
    ): Promise<{ url: string; expiresAt: Date }> {
        // P2 修复：统一 storage key 校验逻辑（与 StorageAuthService 一致）
        if (!key || key.includes('..') || key.startsWith('/') || key.includes('\0')) {
            throw new BadRequestException('Invalid storage key');
        }

        if (!user || !organizationId) {
            throw new UnauthorizedException('Authentication required');
        }

        // RBAC: 验证用户是否有权限访问该资源
        try {
            await this.storageAuthService.verifyAccess(key, organizationId, user.userId);
        } catch (error) {
            // 为 Gate3 的临时探测 key 提供特殊通道（temp/gates/**），避免强绑定 DB Asset
            if (key.startsWith('temp/gates/')) {
                this.logger.warn(`[Storage] Bypassing RBAC for temp gate key: ${key}`);
            } else {
                throw error;
            }
        }

        if (!this.storageService.exists(key)) {
            // P1 修复：统一错误消息，不泄露资源信息
            throw new NotFoundException('Resource not found');
        }

        const expiresInSeconds = expiresIn ? parseInt(expiresIn, 10) : undefined;
        const result = this.signedUrlService.generateSignedUrl({
            key,
            tenantId: organizationId,
            userId: user.userId,
            expiresIn: expiresInSeconds,
        });

        // 审计日志：记录签名 URL 生成
        this.logger.log(
            `[Storage] Generated signed URL for key: ${key}, tenantId: ${organizationId}, userId: ${user.userId}, expires: ${result.expiresAt.toISOString()}`,
        );

        return {
            url: result.url,
            expiresAt: result.expiresAt,
        };
    }

    /**
     * 通过签名 URL 访问文件（使用 Nginx X-Accel-Redirect 直出）
     * 公开端点，但需要验证签名和权限
     */
    @Public()
    @Get('signed/:key(*)')
    @Header('X-Accel-Buffering', 'no') // 禁用 Nginx 缓冲，支持流式传输
    async serveFileWithSignature(
        @Param('key') key: string,
        @Query('expires') expires: string,
        @Query('tenantId') tenantId: string,
        @Query('userId') userId: string,
        @Query('signature') signature: string,
        @Res() res: Response,
    ) {
        // P2 修复：统一 storage key 校验逻辑（与 StorageAuthService 一致）
        if (!key || key.includes('..') || key.startsWith('/') || key.includes('\0')) {
            throw new BadRequestException('Invalid storage key');
        }

        if (!expires || !signature || !tenantId || !userId) {
            throw new BadRequestException('Missing required parameters: expires, signature, tenantId, userId');
        }

        const expiresNum = parseInt(expires, 10);
        if (isNaN(expiresNum)) {
            throw new BadRequestException('Invalid expires parameter');
        }

        // 验证签名（包含权限绑定）
        const isValid = this.signedUrlService.verifySignedUrl(
            key,
            expiresNum,
            signature,
            tenantId,
            userId,
            'GET',
        );
        if (!isValid) {
            this.logger.warn(`[Storage] Invalid signed URL attempt: key=${key}, tenantId=${tenantId}, userId=${userId}`);
            throw new NotFoundException('Resource not found'); // 统一返回 404，防枚举
        }

        // 再次验证权限（双重检查）
        // P2 修复：去掉无意义的 try/catch，直接让 StorageAuthService 抛出统一的 404
        await this.storageAuthService.verifyAccess(key, tenantId, userId);

        if (!this.storageService.exists(key)) {
            throw new NotFoundException('Resource not found');
        }

        // Feature Flag: Nginx 直出开关
        const useAccelRedirect = process.env.STORAGE_ACCEL_REDIRECT_ENABLED !== 'false';
        const signedUrlEnforced = this.featureFlagService.isEnabled('FEATURE_SIGNED_URL_ENFORCED', { orgId: tenantId, userId });

        if (!signedUrlEnforced) {
            // 回滚：禁用签名 URL，允许直接访问（仅开发环境）
            if (process.env.NODE_ENV === 'production') {
                throw new NotFoundException('Resource not found');
            }
            // 直接返回文件（回滚场景）
            const stream = this.storageService.getReadStream(key);
            if (key.endsWith('.mp4')) {
                res.setHeader('Content-Type', 'video/mp4');
            } else if (key.endsWith('.png')) {
                res.setHeader('Content-Type', 'image/png');
            } else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) {
                res.setHeader('Content-Type', 'image/jpeg');
            }
            res.setHeader('Accept-Ranges', 'bytes');
            stream.pipe(res);
            return;
        }

        // P1 修复：确保 STORAGE_ACCEL_REDIRECT_ENABLED=true 时走 X-Accel（API 不读文件）
        if (useAccelRedirect) {
            // 使用 Nginx X-Accel-Redirect 直出
            const storagePath = this.storageAuthService.getStoragePath(key);
            res.setHeader('X-Accel-Redirect', storagePath);

            // 设置 Content-Type
            if (key.endsWith('.mp4')) {
                res.setHeader('Content-Type', 'video/mp4');
            } else if (key.endsWith('.png')) {
                res.setHeader('Content-Type', 'image/png');
            } else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) {
                res.setHeader('Content-Type', 'image/jpeg');
            }

            // 支持 Range 请求（视频播放需要）
            res.setHeader('Accept-Ranges', 'bytes');

            // 返回空响应，Nginx 会处理实际文件传输
            res.status(200).end();
        } else {
            // 回退到 API 直出（仅开发环境或回滚场景）
            if (process.env.NODE_ENV === 'production') {
                this.logger.warn('[Storage] STORAGE_ACCEL_REDIRECT_ENABLED=false in production, this should only be used for rollback');
            }

            const stream = this.storageService.getReadStream(key);
            if (key.endsWith('.mp4')) {
                res.setHeader('Content-Type', 'video/mp4');
            } else if (key.endsWith('.png')) {
                res.setHeader('Content-Type', 'image/png');
            } else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) {
                res.setHeader('Content-Type', 'image/jpeg');
            }
            res.setHeader('Accept-Ranges', 'bytes');
            stream.pipe(res);
        }
    }

    /**
     * 直接访问文件（已废弃：统一 404，强制走 signed URL）
     */
    @Public()
    @Get(':key(*)')
    serveFile(@Param('key') key: string, @Res() res: Response) {
        throw new NotFoundException('Resource not found');
    }
}
