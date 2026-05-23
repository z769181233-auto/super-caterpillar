import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class CopyrightService {
  private readonly logger = new Logger(CopyrightService.name);

  async registerAsset(userId: string, assetType: string, content: string) {
    this.logger.error(
      `[CopyrightService] COPYRIGHT_REGISTRATION_NOT_IMPLEMENTED userId=${userId} assetType=${assetType} contentLength=${content?.length ?? 0}`
    );
    throw new ServiceUnavailableException(
      'COPYRIGHT_REGISTRATION_NOT_IMPLEMENTED: persistence-backed copyright registration is required'
    );
  }

  async verifyAsset(hash: string) {
    this.logger.error(
      `[CopyrightService] COPYRIGHT_VERIFICATION_NOT_IMPLEMENTED hash=${hash}`
    );
    throw new ServiceUnavailableException(
      'COPYRIGHT_VERIFICATION_NOT_IMPLEMENTED: authoritative verification source is required'
    );
  }
}
