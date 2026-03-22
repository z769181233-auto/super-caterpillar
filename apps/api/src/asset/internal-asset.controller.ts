import { Controller, Get, Query, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiSecurityGuard } from '../security/api-security/api-security.guard';
import { SignedUrlService } from '../storage/signed-url.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('_internal/assets')
@UseGuards(ApiSecurityGuard)
export class InternalAssetController {
  constructor(
    private readonly signedUrlService: SignedUrlService,
    private readonly prisma: PrismaService
  ) {}

  @Get('by-storage-key')
  async getPublicUrl(@Query('key') key: string) {
    if (!key) {
      throw new BadRequestException('key is required');
    }

    const found = await this.prisma.asset.findFirst({
      where: { storageKey: key },
      select: {
        project: {
          select: {
            organizationId: true,
            ownerId: true,
          },
        },
      },
    });

    const tenantId = found?.project?.organizationId;
    const userId = found?.project?.ownerId;

    if (!tenantId || !userId) {
      throw new NotFoundException('Asset context not found');
    }

    // Generate a short-lived signed URL for internal tools/gates using real tenant/user context.
    const { url, expiresAt } = this.signedUrlService.generateSignedUrl({
      key,
      tenantId,
      userId,
      expiresIn: 300, // 5 minutes
    });

    return {
      url,
      expiresAt,
      storageKey: key,
    };
  }
}
