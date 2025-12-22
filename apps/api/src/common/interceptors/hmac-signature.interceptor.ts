import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * @deprecated 签名校验逻辑已收拢至 HmacGuard / HmacAuthGuard。
 * P0-2 Timing: 该拦截器不再进行任何拦截或决策逻辑，降级为“纯旁观者”。
 * 严禁在此处执行任何拒绝请求的操作，以免与 Guard 时序产生冗余。
 */
@Injectable()
export class HmacSignatureInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 仅作历史兼容或潜在日志，禁止参与鉴权。
    return next.handle();
  }
}
