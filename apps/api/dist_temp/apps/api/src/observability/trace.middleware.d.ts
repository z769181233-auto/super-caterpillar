import type { Request, Response, NextFunction } from 'express';
import { NestMiddleware } from '@nestjs/common';
export declare class TraceMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction): void;
}
