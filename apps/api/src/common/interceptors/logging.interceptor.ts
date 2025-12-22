import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();

    const http = context.switchToHttp();
    const req = http.getRequest();
    const method = req?.method;
    const url = req?.url;
    const traceId = req?.headers?.['x-trace-id'] || crypto.randomUUID();
    if (req?.headers) {
      req.headers['x-trace-id'] = traceId;
    }

    this.logger.log(`➡️  [${method}] ${url} [TraceID: ${traceId}]`);

    return next.handle().pipe(
      tap(() => {
        const time = Date.now() - now;
        this.logger.log(`⬅️  [${method}] ${url} +${time}ms [TraceID: ${traceId}]`);
      }),
    );
  }
}
