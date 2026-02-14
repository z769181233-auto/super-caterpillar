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
  ) {
    console.log(
      `[EngineHubController] Initialized. engineInvoker defined: ${!!this.engineInvoker}`
    );
  }

  @Post('invoke')
  async invoke(@Body() req: EngineInvocationRequest<unknown>) {
    const jobId = req.metadata?.jobId;
    // P6-0: Physical trace with minimal overhead
    process.stdout.write(`\n!!! [15M-TRACE-ENTRY] JobId: ${jobId} !!!\n`);
    console.error(
      `!!! [15M-DEBUG] JobId: ${jobId} Entry. Keys: ${Object.keys(req.payload || {}).join(',')}`
    );
    if ((req.payload as any)?.raw_text) {
      console.error(`!!! [15M-DEBUG] raw_text len: ${(req.payload as any).raw_text.length}`);
    } else if ((req.payload as any)?.structured_text) {
      console.error(
        `!!! [15M-DEBUG] structured_text len: ${(req.payload as any).structured_text.length}`
      );
    } else {
      console.error(`!!! [15M-DEBUG] NO TEXT FOUND IN PAYLOAD`);
    }

    if (!this.engineInvoker) {
      this.engineInvoker = this.moduleRef.get(EngineInvokerHubService, { strict: false });
    }

    try {
      // P6-0: Forward to invoker which now handles large payloads via AuditLog hardening
      const result = await this.engineInvoker.invoke(req);
      process.stdout.write(`!!! [15M-TRACE-EXIT] JobId: ${jobId} SUCCESS !!!\n`);
      return { success: true, data: result };
    } catch (e: any) {
      process.stdout.write(`!!! [15M-TRACE-CRASH] JobId: ${jobId} ERROR: ${e.message} !!!\n`);
      throw e;
    }
  }
}
