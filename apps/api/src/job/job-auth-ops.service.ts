import { Injectable, Inject, NotFoundException, ForbiddenException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectResolver } from '../common/project-resolver';
import { SHOT_WITH_HIERARCHY } from './job.service.queries';

@Injectable()
export class JobAuthOpsService {
    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService,
        @Inject(forwardRef(() => ProjectResolver))
        private readonly projectResolver: ProjectResolver
    ) { }

    /**
     * Localized Check Shot Ownership (Extracted from JobService)
     */
    async checkShotOwnership(shotId: string, organizationId: string) {
        const shot = await this.prisma.shot.findUnique({
            where: { id: shotId },
            include: SHOT_WITH_HIERARCHY,
        });

        if (!shot) {
            throw new NotFoundException('Shot not found');
        }

        const scene = shot.scene;
        let shotProject = await this.projectResolver.resolveProjectAuthOnly(scene?.episode);

        // V3.0 Fallback
        if (!shotProject && scene?.projectId) {
            shotProject = await this.prisma.project.findUnique({
                where: { id: scene.projectId },
            });
        }

        if (!shotProject) {
            throw new NotFoundException(`Project not found for shot ${shotId}`);
        }

        if (shotProject.organizationId !== organizationId) {
            throw new ForbiddenException('You do not have permission to access this shot');
        }

        return shot;
    }
}
