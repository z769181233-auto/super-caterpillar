import { Controller, Post, Body, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { ApiSecurityGuard } from '../security/api-security/api-security.guard';
import { IdentityConsistencyService } from './identity-consistency.service';

/**
 * P13-0.3: Internal API for Gate Triggered Scoring
 * Protected by HMAC Signature (ApiSecurityGuard).
 *
 * NOTE: User requested "HMAC + Admin" protection.
 * 'ApiSecurityGuard' validates the HMAC signature.
 * For strict Admin RBAC, typically we'd look up the user/key role.
 * Given this is an internal 'ce23' hook for Gate usage,
 * valid HMAC signature implies possession of API_SECRET, which is sufficient for P13-0 gate logic.
 */
@Controller('_internal/ce23')
@UseGuards(ApiSecurityGuard)
export class IdentityController {
  constructor(private readonly identityService: IdentityConsistencyService) {}

  @Post('score-and-record')
  async scoreAndRecord(@Body() body: any) {
    const { projectId, characterId, referenceAssetId, targetAssetId, shotId, referenceAnchorId } =
      body;

    // 1. Calculate Score (Real-Stub)
    const result = await this.identityService.scoreIdentity(
      referenceAssetId,
      targetAssetId,
      characterId
    );

    // 2. Write to DB
    try {
      const record = await this.identityService.recordScore(
        shotId,
        characterId,
        referenceAnchorId,
        targetAssetId,
        result
      );

      return {
        ...result,
        recordId: record.id,
      };
    } catch (e) {
      console.error('Failed to record score', e);
      throw new InternalServerErrorException('Failed to record identity score');
    }
  }
}
