import { PrismaService } from '../prisma/prisma.service';
import { ProjectService } from './project.service';
import { ProjectStructureTree } from '@scu/shared-types';
export declare class ProjectStructureService {
    private readonly prisma;
    private readonly projectService;
    constructor(prisma: PrismaService, projectService: ProjectService);
    getProjectStructureTree(projectId: string, userId: string, organizationId: string): Promise<ProjectStructureTree>;
}
