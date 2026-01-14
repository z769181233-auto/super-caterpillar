import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiSecurityModule } from '../security/api-security/api-security.module';
import { TextSafetyModule } from '../text-safety/text-safety.module';
import { NovelImportController } from './novel-import.controller';
import { NovelImportService } from './novel-import.service';
import { FileParserService } from './file-parser.service';
import { NovelAnalysisProcessorService } from './novel-analysis-processor.service';
import { NovelAnalysisEngineService } from './novel-analysis-engine.service';
import { NovelStructureGeneratorService } from './novel-structure-generator.service';
import { NovelAnalysisJobProcessorService } from './novel-analysis-job-processor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectModule } from '../project/project.module';
import { TaskModule } from '../task/task.module';
import { JobModule } from '../job/job.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuditModule } from '../audit/audit.module';
import { PermissionModule } from '../permission/permission.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

@Module({
  imports: [
    PrismaModule,
    ProjectModule,
    TaskModule,
    JobModule,
    AuditLogModule,
    AuditModule,
    PermissionModule,
    forwardRef(() => OrchestratorModule),
    ApiSecurityModule,
    AuthModule,
    TextSafetyModule,
  ],
  controllers: [NovelImportController],
  providers: [
    NovelImportService,
    FileParserService,
    NovelAnalysisProcessorService,
    NovelAnalysisEngineService,
    NovelStructureGeneratorService,
    NovelAnalysisJobProcessorService,
  ],
  exports: [
    NovelImportService,
    FileParserService,
    NovelAnalysisProcessorService,
    NovelAnalysisEngineService,
  ],
})
export class NovelImportModule { }
