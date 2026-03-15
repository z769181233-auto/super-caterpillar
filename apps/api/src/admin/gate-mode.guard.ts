import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class GateModeGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    // P1 SEALed: No longer allows bypass via GATE_MODE=1 or test.
    // Strictly requires explicit admin credentials or internal system tokens.
    throw new ForbiddenException('GATE_MODE bypass is permanently disabled for security hardening.');
  }
}
