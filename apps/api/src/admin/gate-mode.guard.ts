import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class GateModeGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext) {
    if (process.env.GATE_MODE === '1') return true;
    throw new ForbiddenException('GATE_MODE required');
  }
}
