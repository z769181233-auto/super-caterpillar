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
  // A4: Environment Integrity Guard
  try {
    validateRequiredEnvs();
  } catch (e) {
    console.error('[FATAL] Environment validation failed. Service will exit.');
    process.exit(1);
  }

  console.log('[BOOTSTRAP] Calling NestFactory.create(AppModule)...');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });
  console.log('[BOOTSTRAP] NestFactory.create() returned.');

  app.useLogger(app.get(Logger));

  app.use('/api/workers', (req: any, res: any, next: any) => {
    console.log(`[API_WORKER_PRE] hit method=${req.method} url=${req.originalUrl || req.url}`);
    console.log(`[API_WORKER_PRE] headers keys=${Object.keys(req.headers).join(',')}`);
    console.log(`[API_WORKER_PRE] next()`);
    next();
  });

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

  console.log('[BOOTSTRAP] Calling app.init()...');
  await app.init();
  console.log('[BOOTSTRAP] app.init() returned.');

  console.log(`[BOOTSTRAP] Attempting app.listen on port ${port}...`);
  await app.listen(port, '0.0.0.0');
  console.log(`[BOOTSTRAP] app.listen() returned on port ${port}.`);
}

bootstrap().catch(e => {
  console.error('[BOOTSTRAP_ERROR]', e);
  process.exit(1);
});
