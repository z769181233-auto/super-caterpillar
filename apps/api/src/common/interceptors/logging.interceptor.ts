import { CallHandler, ExecutionContext, Injectable, NestInterceptor, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const method = req?.method;
    const url = req?.url;
    const traceId = req?.headers?.['x-trace-id'] || crypto.randomUUID();
    if (req?.headers) {
      req.headers['x-trace-id'] = traceId;
    }

    // 请求进入
    this.logger.log(`REQ_IN traceId=${traceId} method=${method} url=${url}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const costMs = Date.now() - now;
          const status = res?.statusCode || 200;
          // 请求结束
          this.logger.log(`REQ_OUT traceId=${traceId} status=${status} costMs=${costMs}`);
        },
        error: (err) => {
          const costMs = Date.now() - now;
          const status = err?.status || res?.statusCode || 500;
          this.logger.error(
            `REQ_OUT traceId=${traceId} status=${status} costMs=${costMs} error=${err?.message}`
          );
        },
      })
    );
  }
}
