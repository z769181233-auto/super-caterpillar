import {
  Body,
  Controller,
  Post,
  UseGuards,
  Logger,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { EngineInvocationRequest } from '@scu/shared-types';
import { EngineInvokerHubService } from './engine-invoker-hub.service';
import { ModuleRef } from '@nestjs/core';

@Controller('_internal/engine')
@UseGuards(JwtOrHmacGuard)
export class EngineHubController {
  private readonly logger = new Logger(EngineHubController.name);

  constructor(
    private readonly moduleRef: ModuleRef,
    @Inject(EngineInvokerHubService)
    private engineInvoker: EngineInvokerHubService
  ) {}

  @Post('invoke')
  async invoke(@Body() req: EngineInvocationRequest<unknown>) {
    const jobId = req.metadata?.jobId;
    this.logger.log(`[EngineHubController] invoke jobId=${jobId || 'unknown'}`);

    if (!this.engineInvoker) {
      this.engineInvoker = this.moduleRef.get(EngineInvokerHubService, { strict: false });
    }

    try {
      // P6-0: Forward to invoker which now handles large payloads via AuditLog hardening
      const result = await this.engineInvoker.invoke(req);
      this.logger.log(`[EngineHubController] invoke success jobId=${jobId || 'unknown'}`);
      return { success: true, data: result };
    } catch (e: any) {
      this.logger.error(
        `[EngineHubController] invoke failed jobId=${jobId || 'unknown'}: ${e?.message || 'unknown error'}`
      );
      throw e;
    }
  }
}
