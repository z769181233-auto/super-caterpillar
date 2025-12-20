import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from 'config';

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
  app.use(helmet({
    contentSecurityPolicy: env.isProduction,
    crossOriginEmbedderPolicy: false, // 允许跨域嵌入（如果需要）
  }));

  // Cookie parser
  app.use(cookieParser());

  // Global prefix (排除健康检查端点)
  app.setGlobalPrefix('api', {
    exclude: ['/health', '/health/live', '/health/ready', '/health/gpu', '/ping', '/metrics', '/api/health'],
  });

  // CORS: 生产环境使用白名单，开发环境允许前端 URL
  // P1 修复：生产环境必须要求 CORS_ORIGINS，没有就启动失败
  if (env.isProduction) {
    if (!process.env.CORS_ORIGINS) {
      const logger = app.get(Logger);
      logger.error(
        '[FATAL] CORS_ORIGINS is required in production environment. ' +
        'Please set CORS_ORIGINS environment variable (comma-separated origins).',
      );
      process.exit(1);
    }
  }

  const corsOrigins = env.isProduction
    ? process.env.CORS_ORIGINS!.split(',').map((o) => o.trim()).filter(Boolean)
    : [env.frontendUrl || 'http://localhost:3001'];

  app.enableCors({
    origin: (origin, callback) => {
      // 允许无 origin 的请求（如 Postman、curl）
      if (!origin) {
        return callback(null, true);
      }

      // 生产环境：严格检查白名单
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

  const logger = app.get(Logger);
  logger.log(`🚀 API Server is running on: http://localhost:${env.apiPort}`);
}

bootstrap();











