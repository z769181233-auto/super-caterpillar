import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from '@scu/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Global exception filter (Registered in AppModule via APP_FILTER)

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 注意：Guards 和 Interceptors 已通过 APP_GUARD / APP_INTERCEPTOR 在 AppModule 中注册
  // 禁止在 main.ts 中手动 new，否则会导致 DI 注入失败

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Security: Helmet
  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction,
      crossOriginEmbedderPolicy: false, // 允许跨域嵌入（如果需要）
    })
  );

  // Cookie parser
  app.use(cookieParser());

  // Global prefix (排除健康检查端点)
  app.setGlobalPrefix('api', {
    exclude: [
      '/health',
      '/health/live',
      '/health/ready',
      '/health/gpu',
      '/ping',
      '/metrics',
      '/api/health',
    ],
  });

  // CORS: 生产环境使用白名单，开发环境允许前端 URL
  // P1 修复：生产环境必须要求 CORS_ORIGINS，没有就启动失败
  if (env.isProduction) {
    if (!process.env.CORS_ORIGINS) {
      const logger = app.get(Logger);
      logger.error('[CORS] FATAL: CORS_ORIGINS is required in production, but not set.');
      process.exit(1);
    }
  }

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3001', 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (env.isProduction) {
        if (corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        // 开发环境：允许所有来源
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Nonce', 'X-Timestamp', 'X-Signature'],
  });

  await app.listen(env.apiPort);

  // P0 Self-Verification: Check if StorageController is registered
  try {
    const { ModulesContainer } = await import('@nestjs/core');
    const { StorageController } = await import('./storage/storage.controller');

    const modules = app.get(ModulesContainer);
    let hasStorageController = false;
    let totalControllers = 0;

    for (const [_, mod] of modules.entries()) {
      for (const ctrl of mod.controllers.values()) {
        totalControllers++;
        if (ctrl.metatype === StorageController) {
          hasStorageController = true;
          console.log(`[P0_EVIDENCE] Found StorageController in module: ${mod.metatype?.name}`);
        }
      }
    }

    console.log(`[P0_EVIDENCE] StorageController registered = ${hasStorageController}`);
    console.log(`[P0_EVIDENCE] Total controllers registered = ${totalControllers}`);
  } catch (e) {
    console.error('[P0_EVIDENCE] Failed to check modules:', e);
  }

  const logger = app.get(Logger);
  logger.log(`🚀 API Server is running on: http://localhost:${env.apiPort}`);
}

bootstrap();
