import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env, validateRequiredEnvs } from '@scu/config';
import { json, urlencoded } from 'express';
import * as util from 'util';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Force load .env.local for Production Real Engine keys
const repoRoot = path.resolve(__dirname, '../../../');
const envLocalPath = path.join(repoRoot, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('[Bootstrap] Loaded .env.local');
}

process.on('uncaughtException', (e) => {
  process.stderr.write(`[CRASH] uncaughtException: ${e?.message}\n${e?.stack}\n`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[CRASH] unhandledRejection: ${util.inspect(reason, { depth: 5 })}\n`);
  process.exit(1);
});

async function bootstrap() {
  const isStubMode = process.env.P9_B3_STUB_MODE === '1';

  // P0-2: Wait for 10s to ensure background services (like Job Worker) are ready
  console.log('[BOOTSTRAP] Waiting 10s for environment stabilizing...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // A4: Environment Integrity Guard
  try {
    validateRequiredEnvs();
  } catch (e) {
    if (!isStubMode) {
      console.error('[FATAL] Environment validation failed. Service will exit.');
      process.exit(1);
    }
  }

  console.log('[BOOTSTRAP] Calling NestFactory.create(AppModule)...');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });
  console.log('[BOOTSTRAP] NestFactory.create() returned.');

  app.useLogger(app.get(Logger));

  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));

  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(cookieParser());

  app.setGlobalPrefix('api', {
    exclude: ['metrics', 'health', 'ping', 'api/health', 'health/(.*)', 'api/health/(.*)'],
  });

  const port = Number(process.env.PORT) || 3000;

  console.log(`[BOOTSTRAP] Attempting app.listen on port ${port}...`);
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch(e => {
  console.error('[BOOTSTRAP_ERROR]', e);
  process.exit(1);
});
