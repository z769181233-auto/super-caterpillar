import { Body, Controller, Post, UseGuards, Logger, ForbiddenException } from '@nestjs/common';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { EngineInvocationRequest } from '@scu/shared-types';
import { EngineInvokerHubService } from './engine-invoker-hub.service';

@Controller('_internal/engine')
@UseGuards(JwtOrHmacGuard)
export class EngineHubController {
  private readonly logger = new Logger(EngineHubController.name);

  constructor(private readonly engineInvoker: EngineInvokerHubService) { }

  @Post('invoke')
  async invoke(@Body() req: EngineInvocationRequest<unknown>) {
    // 风险A收口：仅在 GATE_MODE=1 时允许内部直连调用
    // if (process.env.GATE_MODE !== '1') {
    //   throw new ForbiddenException('Internal engine invocation is only allowed in GATE_MODE');
    // }
    const result = await this.engineInvoker.invoke(req);
    return { success: true, data: result };
  }
}
