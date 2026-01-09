import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { JobService } from '../job/job.service';
import { AuthenticatedUser } from '@scu/shared-types';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const jobService = app.get(JobService);

  const type = process.env.JOB_TYPE;
  const shotId = process.env.SHOT_ID || 'shot_p2_gate';
  const orgId = process.env.ORG_ID || 'org_p2_gate';
  const userId = process.env.USER_ID || 'user_p2_gate';
  const payloadJson = process.env.JOB_PAYLOAD || '{}';

  if (!type) {
    console.error('JOB_TYPE env var required');
    process.exit(1);
  }

  try {
    const payload = JSON.parse(payloadJson);
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const job = await jobService.create(
      shotId,
      { type: type as any, payload, traceId },
      userId,
      orgId
    );
    console.log(`JOB_ID=${job.id}`);
    console.log(`TRACE_ID=${traceId}`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

bootstrap();
