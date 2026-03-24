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
    process.stderr.write('[FATAL] Environment validation failed. Service will exit.\n');
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));

  app.enableCors({
    origin: [env.frontendUrl, 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
  });

  // P1 Security: Reduce global body limits to prevent DOS (100MB -> 50MB for general metadata)
  // Large file uploads (Novels/Assets) should use streaming or signed URLs
  const bodyLimit = process.env.GLOBAL_BODY_LIMIT || '50mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

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

  await app.init();

  await app.listen(port, '0.0.0.0');
}

bootstrap().catch(e => {
  process.stderr.write(
    `[BOOTSTRAP_ERROR] ${e instanceof Error ? e.message : String(e)}\n`
  );
  process.exit(1);
});
