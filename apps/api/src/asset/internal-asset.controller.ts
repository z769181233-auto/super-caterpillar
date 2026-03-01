import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiSecurityGuard } from '../security/api-security/api-security.guard';
import { SignedUrlService } from '../storage/signed-url.service';

@Controller('_internal/assets')
@UseGuards(ApiSecurityGuard)
export class InternalAssetController {
  constructor(private readonly signedUrlService: SignedUrlService) {}

  @Get('by-storage-key')
  getPublicUrl(@Query('key') key: string) {
    if (!key) {
      throw new BadRequestException('key is required');
    }

    // Generate a short-lived signed URL for internal tools/gates
    // Using a system userId/tenantId for this internal access or could accept them as query params if needed
    // For Gate preview, we can use a generic "system-gate" context.
    const { url, expiresAt } = this.signedUrlService.generateSignedUrl({
      key,
      tenantId: 'system-gate',
      userId: 'system-gate-user',
      expiresIn: 300, // 5 minutes
    });

    return {
      url,
      expiresAt,
      storageKey: key,
    };
  }
}
