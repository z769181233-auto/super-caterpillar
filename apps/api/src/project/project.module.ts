import { Module, forwardRef } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectStructureController } from './project-structure.controller';
import { ProjectService } from './project.service';
import { ProjectStructureService } from './project-structure.service';
import { ProjectProductionStateService } from './project-production-state.service';
import { ProjectStudioCharacterBibleService } from './project-studio-character-bible.service';
import { ProjectStudioDirectorScriptService } from './project-studio-director-script.service';
import { ProjectStudioEpisodePlanService } from './project-studio-episode-plan.service';
import { ProjectStudioLocationBibleService } from './project-studio-location-bible.service';
import { ProjectStudioShotScriptService } from './project-studio-shot-script.service';
import { ProjectStudioStoryboardAssetService } from './project-studio-storyboard-asset.service';
import { ProjectStudioStoryBibleService } from './project-studio-story-bible.service';
import { ProjectStudioVideoPromptService } from './project-studio-video-prompt.service';
import { ProjectVideoScriptService } from './project-video-script.service';
import { StructureGenerateService } from './structure-generate.service';
import { SceneGraphService } from './scene-graph.service';
import { SceneGraphCache } from './scene-graph.cache';
import { UserModule } from '../user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionModule } from '../permission/permission.module';
import { JobModule } from '../job/job.module';
import { TaskModule } from '../task/task.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuditModule } from '../audit/audit.module';
import { RedisModule } from '../redis/redis.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';

import { ProjectResolver } from '../common/project-resolver';

@Module({
  imports: [
    UserModule,
    PrismaModule,
    forwardRef(() => JobModule),
    PermissionModule,
    forwardRef(() => TaskModule),
    AuthModule,
    AuditLogModule,
    AuditModule,
    RedisModule,
    ApiSecurityModule,
  ],
  controllers: [ProjectController, ProjectStructureController],
  providers: [
    ProjectService,
    ProjectStructureService,
    ProjectProductionStateService,
    ProjectStudioCharacterBibleService,
    ProjectStudioDirectorScriptService,
    ProjectStudioEpisodePlanService,
    ProjectStudioLocationBibleService,
    ProjectStudioShotScriptService,
    ProjectStudioStoryboardAssetService,
    ProjectStudioStoryBibleService,
    ProjectStudioVideoPromptService,
    ProjectVideoScriptService,
    StructureGenerateService,
    SceneGraphService,
    SceneGraphCache,
    ProjectResolver,
  ],
  exports: [
    ProjectService,
    ProjectStructureService,
    ProjectProductionStateService,
    ProjectStudioCharacterBibleService,
    ProjectStudioDirectorScriptService,
    ProjectStudioEpisodePlanService,
    ProjectStudioLocationBibleService,
    ProjectStudioShotScriptService,
    ProjectStudioStoryboardAssetService,
    ProjectStudioStoryBibleService,
    ProjectStudioVideoPromptService,
    ProjectVideoScriptService,
    StructureGenerateService,
    SceneGraphService,
    ProjectResolver,
  ],
})
export class ProjectModule { }
