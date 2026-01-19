import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { ContractStoryController } from './contract-story.controller';
import { ContractShotController } from './contract-shot.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StoryModule } from '../story/story.module';
import { JobModule } from '../job/job.module';

@Module({
  imports: [PrismaModule, ProjectModule, OrchestratorModule, StoryModule, JobModule],
  controllers: [ContractStoryController, ContractShotController],
})
export class V3Module {}
