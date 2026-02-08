import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { Request } from 'express';
import { ApiSecurityService } from '../../security/api-security/api-security.service';

/**
 * HMAC 认证服务 (SSOT Wrapper)
 * 核心校验逻辑已收口至 ApiSecurityService。
 * 此服务仅作为 HmacAuthGuard 的适配器，确保全局 HMAC 行为一致。
 */
@Injectable()
export class HmacAuthService {
  constructor(
    @Inject(forwardRef(() => ApiSecurityService))
    private readonly apiSecurity: ApiSecurityService
  ) { }

  /**
   * 验证 HMAC 签名
   * 委托至 ApiSecurityService 执行 Strict V1.1 / Canonical V2 校验。
   */
  async verifySignature(
    apiKeyArg: string,
    methodArg: string,
    pathArg: string,
    bodyArg: string,
    nonceArg: string,
    timestampArg: string,
    signatureArg: string,
    debug?: { ip?: string; ua?: string; workerId?: string; contentSha256?: string; hmacVersion?: string }
  ) {
    // 委托调用 ApiSecurityService
    const result = await this.apiSecurity.verifySignature({
      apiKey: apiKeyArg,
      nonce: nonceArg,
      timestamp: timestampArg,
      signature: signatureArg,
      method: methodArg,
      path: pathArg,
      body: bodyArg,
      // [P6-0 Fix] Pass pre-calculated hash if body is bypassed OR if client provides it (for strict matching)
      contentSha256: (debug as any)?.contentSha256 || '',
      ip: debug?.ip,
      userAgent: debug?.ua,
    } as any);

    if (!result.success) {
      throw new UnauthorizedException(result.errorMessage || 'Invalid signature');
    }

    // 返回 keyRecord 以满足原有 Guard 的后续逻辑（附加到 Request）
    return result.apiKeyRecord;
  }
}
