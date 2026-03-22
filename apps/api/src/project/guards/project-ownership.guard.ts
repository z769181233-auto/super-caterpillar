import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Project Ownership Guard
 * 校验当前用户是否为项目所有者
 */
@Injectable()
export class ProjectOwnershipGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
    const projectId = request.params?.id || request.params?.projectId;
    const userId =
      request.user?.userId || request.user?.id || request.apiKeyOwnerUserId || request.apiKey?.ownerUserId;

    if (!projectId) {
      throw new ForbiddenException('Project id is required');
    }

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to access this project');
    }

    return true;
  }
}
