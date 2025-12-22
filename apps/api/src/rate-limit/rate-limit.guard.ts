import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorageService } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

// ...

@Injectable()
export class FineGrainedRateLimitGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorageService,
    reflector: Reflector
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 使用 IP + User ID 组合作为追踪器
    const userId = req.user?.id || req.user?.userId || 'anonymous';
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return `${ip}:${userId}`;
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // 获取限流配置（如果有）
    const limit = this.reflector.get<number>('rateLimit', context.getHandler());
    const ttl = this.reflector.get<number>('rateLimitTtl', context.getHandler());

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `请求过于频繁，请稍后再试。限制：${limit || 100} 次/${ttl || 60}秒`,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

/**
 * 装饰器：为接口配置细粒度限流
 */
export const RateLimit = (limit: number, ttl: number = 60) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata('rateLimit', limit, descriptor.value);
      Reflect.defineMetadata('rateLimitTtl', ttl, descriptor.value);
    }
    return descriptor;
  };
};

