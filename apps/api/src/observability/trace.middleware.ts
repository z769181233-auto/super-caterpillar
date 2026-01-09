import type { Request, Response, NextFunction } from 'express';
import { newTraceId, runWithTrace } from '@scu/observability';
import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = (req.headers['x-trace-id'] as string | undefined) ?? '';
    const traceId = incoming || newTraceId();
    res.setHeader('x-trace-id', traceId);
    // 同时写入 req 用于后续 interceptor/guard 读取
    (req as any).traceId = traceId;
    runWithTrace(traceId, () => next());
  }
}
