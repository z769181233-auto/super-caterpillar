import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JobWorkerService } from './job-worker.service';
import { JobModule } from './job.module';

/**
 * Legacy internal worker module (conditionally loaded).
 * Only imported when JOB_WORKER_ENABLED=true.
 */
@Module({
  imports: [
    PrismaModule,
    JobModule, // ensure JobService is available if JobWorkerService depends on it
  ],
  providers: [JobWorkerService],
  exports: [JobWorkerService],
})
export class JobWorkerModule {}
