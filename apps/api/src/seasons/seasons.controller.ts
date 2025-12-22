
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SeasonsService } from './seasons.service';
import { ProjectService } from '../project/project.service';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { ProjectPermissions } from '../permission/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { AuthenticatedUser } from '@scu/shared-types';
import { CreateSeasonDto } from './dto/create-season.dto';
import { randomUUID } from 'crypto';

@Controller('projects/:projectId/seasons')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class SeasonsController {
    constructor(
        private readonly seasons: SeasonsService,
        private readonly projectService: ProjectService
    ) { }

    @Post()
    @Permissions(ProjectPermissions.PROJECT_WRITE)
    async create(
        @Param('projectId') projectId: string,
        @Body() body: CreateSeasonDto,
        @CurrentUser() user: AuthenticatedUser,
        @CurrentOrganization() organizationId: string | null
    ) {
        if (!organizationId) throw new Error('No organization context');

        await this.projectService.checkOwnership(projectId, user.userId);

        const data = await this.seasons.create(projectId, body);
        return {
            success: true,
            data,
            requestId: randomUUID(),
            timestamp: new Date().toISOString(),
        };
    }

    @Get()
    @Permissions(ProjectPermissions.PROJECT_READ)
    async list(
        @Param('projectId') projectId: string,
        @CurrentUser() user: AuthenticatedUser,
        @CurrentOrganization() organizationId: string | null
    ) {
        if (!organizationId) throw new Error('No organization context');

        await this.projectService.checkOwnership(projectId, user.userId);

        const data = await this.seasons.list(projectId);
        return {
            success: true,
            data,
            requestId: randomUUID(),
            timestamp: new Date().toISOString(),
        };
    }
}
