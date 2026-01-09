import { Injectable } from '@nestjs/common';

@Injectable()
export class ObservabilityService {
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
    };
  }
}
