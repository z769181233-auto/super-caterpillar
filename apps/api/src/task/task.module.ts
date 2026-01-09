import { Module, forwardRef } from '@nestjs/common';
import { TaskService } from './task.service';
import { EngineTaskService } from './engine-task.service';
import { TaskGraphService } from './task-graph.service';
import { TaskGraphController } from './task-graph.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { EngineModule } from '../engines/engine.module';
import { QualityScoreService } from '../quality/quality-score.service';
import { QualityFeedbackService } from '../quality/quality-feedback.service';
import { JobModule } from '../job/job.module'; // S3-C.3: 导入 JobModule 以使用 JobService 的统一方法

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    EngineModule, // 导入 EngineModule 以使用 EngineRegistry
    forwardRef(() => JobModule), // S3-C.3: 导入 JobModule（使用 forwardRef 避免循环依赖）
  ],
  controllers: [TaskGraphController],
  providers: [
    TaskService,
    EngineTaskService,
    TaskGraphService,
    QualityScoreService,
    QualityFeedbackService,
  ],
  exports: [TaskService, EngineTaskService, TaskGraphService, QualityScoreService], // 导出所有服务
})
export class TaskModule {}
