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
    console.log(
      `[EngineHubController] invoke called. engineInvoker defined: ${!!this.engineInvoker}`
    );
    if (!this.engineInvoker) {
      console.warn(
        '[EngineHubController] engineInvoker is undefined in invoke! Attempting manual resolution...'
      );
      try {
        this.engineInvoker = this.moduleRef.get(EngineInvokerHubService, { strict: false });
        console.log(`[EngineHubController] Manual resolution success: ${!!this.engineInvoker}`);
      } catch (e) {
        console.error(`[EngineHubController] Manual resolution FAILED: ${e}`);
      }
    }

    // 风险A收口：仅在 GATE_MODE=1 时允许内部直连调用
    // if (process.env.GATE_MODE !== '1') {
    //   throw new ForbiddenException('Internal engine invocation is only allowed in GATE_MODE');
    // }
    const result = await this.engineInvoker.invoke(req);
    return { success: true, data: result };
  }
}
