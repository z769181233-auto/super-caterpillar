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

async function bootstrap() {
  const isStubMode = process.env.P9_B3_STUB_MODE === '1';

  // A4: Environment Integrity Guard
  try {
    validateRequiredEnvs();
  } catch (e) {
    if (!isStubMode) {
      console.error('[FATAL] Environment validation failed. Service will exit.');
      process.exit(1);
    }
  }

  // B.3 Hardening: 如果开启了 Stub 模式且检测到环境变量缺失，则进入 Stub 模式
  const missingEnvs = (process as any).missingEnvs || [];
  if (isStubMode && missingEnvs.length > 0) {
    const port = Number(process.env.PORT) || 3000;
    const http = require('http');
    const server = http.createServer((req: any, res: any) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url?.includes('health')) {
        res.end(JSON.stringify({
          status: 'ok',
          mode: 'stub',
          service: 'api',
          missing_envs: missingEnvs,
          ts: new Date().toISOString(),
          p9_b3_gate: 'active'
        }));
      } else {
        res.end(JSON.stringify({
          message: 'Super Caterpillar Universe API (B.3 Hardened Stub Mode)',
          mode: 'stub'
        }));
      }
    });
    server.listen(port, '0.0.0.0', () => {
      console.warn(`⚠️  API is running in STUB MODE (P9_B3_STUB_MODE=1) on port ${port}`);
      console.warn(`⚠️  Missing Envs: ${missingEnvs.join(', ')}`);
    });
    return;
  }

  // 诊断环境变量加载情况
  process.stdout.write(
    util.format(
      `[GATE_DIAGNOSTIC] GATE_MODE=${process.env.GATE_MODE}, NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}, HMAC_DEBUG=${process.env.HMAC_DEBUG}`
    ) + '\n'
  );

  process.stdout.write(
    util.format(
      `[GATE_DIAGNOSTIC] GATE_MODE=${process.env.GATE_MODE}, NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}, HMAC_DEBUG=${process.env.HMAC_DEBUG}`
    ) + '\n'
  );

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  // P0-NET: Increase body limit for 15M novel import (approx 15-30MB JSON)
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));

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
      // V3 Contract Facade (Root Level)
      'v3/story/(.*)',
      'v3/shot/(.*)',
      'v3/(.*)',
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
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Nonce',
      'X-Timestamp',
      'X-Signature',
      'X-Api-Key',
    ],
  });

  // HMAC_DEBUG: Request Tap (only when debugging HMAC issues)
  if (process.env.HMAC_DEBUG === '1') {
    app.use((req: any, res: any, next: any) => {
      try {
        // Do not read body (avoid affecting rawBody), only log basic info + key headers
        const h = req.headers || {};
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            tag: 'REQ_TAP',
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip,
            ua: h['user-agent'],
            xApiKey: h['x-api-key'],
            xTimestamp: h['x-timestamp'],
            xNonce: h['x-nonce'],
            xSignaturePrefix:
              typeof h['x-signature'] === 'string' ? h['x-signature'].slice(0, 12) : undefined,
          })
        );
      } catch {
        // Ignore JSON stringify errors in HMAC debug logging
      }
      next();
    });
  }

  // 🔧 PORT 必须从环境变量读取，禁止硬编码
  const port = Number(process.env.PORT) || 3000;

  // LISTEN DIAGNOSTIC: hard evidence around binding
  process.stdout.write(
    util.format(`[LISTEN_DIAG] before_listen host=127.0.0.1 port=${port} pid=${process.pid}`) + '\n'
  );

  try {
    // 强制绑定到 0.0.0.0（兼容 Docker 和本地验证）
    await app.listen(port, '0.0.0.0');

    const addr: any = app.getHttpServer()?.address?.();
    process.stdout.write(
      util.format(
        `[LISTEN_DIAG] after_listen address=${typeof addr === 'string' ? addr : JSON.stringify(addr)}`
      ) + '\n'
    );
  } catch (e: any) {
    process.stderr.write(
      util.format(
        `[LISTEN_DIAG] listen_failed name=${e?.name} code=${e?.code} errno=${e?.errno} syscall=${e?.syscall} address=${e?.address} port=${e?.port} message=${e?.message}`
      ) + '\n'
    );
    process.exit(1);
  }

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
          process.stdout.write(
            util.format(`[P0_EVIDENCE] Found StorageController in module: ${mod.metatype?.name}`) +
            '\n'
          );
        }
      }
    }

    process.stdout.write(
      util.format(`[P0_EVIDENCE] StorageController registered = ${hasStorageController}`) + '\n'
    );
    process.stdout.write(
      util.format(`[P0_EVIDENCE] Total controllers registered = ${totalControllers}`) + '\n'
    );
  } catch (e) {
    process.stderr.write(util.format('[P0_EVIDENCE] Failed to check modules:', e) + '\n');
  }

  const logger = app.get(Logger);
  logger.log(`🚀 API Server is running on: http://localhost:${port}`);
}

bootstrap();
