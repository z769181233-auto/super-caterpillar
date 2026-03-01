import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * EXEC-P11-4.1: Operational Gate Guard
 * 更高优先级的阻断逻辑，防止中间件在复杂路由下被跳过。
 */
@Injectable()
export class OperationalGateGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const orgId = (request.headers['x-scu-org-id'] || request.headers['x-org-id']) as string;
    const url = request.originalUrl || request.url;

    // 1. Engine Offline Check
    if (url.includes('/ce-dag/run') || url.includes('/v3/story/parse')) {
      const offlineEngines = await this.prisma.engine.findMany({
        where: { enabled: false },
        select: { engineKey: true },
      });

      if (offlineEngines.length > 0) {
        const isCriticalOffline = offlineEngines.some((e) =>
          [
            'character_visual',
            'default_novel_analysis',
            'default_shot_render',
            'real_shot_render',
          ].includes(e.engineKey)
        );

        if (isCriticalOffline) {
          throw new ServiceUnavailableException({
            error_code: 'ERR_ENGINE_OFFLINE',
            message: 'Critical engine is offline. Generation suspended.',
          });
        }
      }
    }

    // 2. Feature Flag (Blocked Org)
    if (orgId) {
      if (orgId.includes('blocked_')) {
        throw new ForbiddenException({
          error_code: 'ERR_FEATURE_DISABLED',
          message: 'This feature is disabled for your organization.',
        });
      }

      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { type: true },
      });

      if (org?.type === 'LIMITED_ACCESS') {
        throw new ForbiddenException({
          error_code: 'ERR_LIMITED_ACCESS',
          message: 'Access restricted for this organization type.',
        });
      }
    }

    return true;
  }
}
