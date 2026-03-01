import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JobModule } from '../job/job.module';
import { AuthModule } from '../auth/auth.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { PermissionModule } from '../permission/permission.module';
import { CEDagController } from './ce-dag.controller';
import { CEDagOrchestratorService } from './ce-dag-orchestrator.service';

@Module({
  imports: [PrismaModule, JobModule, AuthModule, ApiSecurityModule, PermissionModule],
  controllers: [CEDagController],
  providers: [CEDagOrchestratorService],
  exports: [CEDagOrchestratorService],
})
export class CEPipelineModule {}
