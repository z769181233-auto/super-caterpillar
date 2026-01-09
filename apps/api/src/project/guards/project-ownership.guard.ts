import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

/**
 * Project Ownership Guard
 * 项目所有权验证 Guard（最小可用实现）
 */
@Injectable()
export class ProjectOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // 最小可用实现，暂时返回 true
    return true;
  }
}
