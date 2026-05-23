import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
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

    const matches = await this.prisma.asset.findMany({
      where: { storageKey: key },
      take: 2,
      select: {
        project: {
          select: {
            organizationId: true,
            ownerId: true,
          },
        },
      },
    });

    if (matches.length === 0) {
      throw new NotFoundException('Asset context not found');
    }

    const distinctContexts = new Set(
      matches.map((asset) => `${asset.project?.organizationId ?? 'null'}:${asset.project?.ownerId ?? 'null'}`)
    );
    if (distinctContexts.size > 1) {
      throw new ConflictException('Ambiguous asset context for storage key');
    }

    const tenantId = matches[0]?.project?.organizationId;
    const userId = matches[0]?.project?.ownerId;

    if (!tenantId || !userId) {
      throw new NotFoundException('Asset context not found');
    }

    // Generate a short-lived signed URL for internal tools/gates using real tenant/user context.
    const { url, expiresAt } = await this.signedUrlService.generateSignedUrl({
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
