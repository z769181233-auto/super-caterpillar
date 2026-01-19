import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { ContractStoryController } from './contract-story.controller';
import { ContractShotController } from './contract-shot.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StoryModule } from '../story/story.module';
import { JobModule } from '../job/job.module';

import { AssetReceiptResolverService } from './asset-receipt-resolver.service';

@Module({
  imports: [PrismaModule, ProjectModule, OrchestratorModule, StoryModule, JobModule],
  controllers: [ContractStoryController, ContractShotController],
  providers: [AssetReceiptResolverService],
})
export class V3Module {}
