import { NestFactory } from '@nestjs/core';
import { AppModule } from './apps/api/src/app.module';
import { CostIngestJob } from './apps/api/src/cost/cost-ingest.job';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const job = app.get(CostIngestJob);
  await job.handleCron();
  await app.close();
}
bootstrap();
