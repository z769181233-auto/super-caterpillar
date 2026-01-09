import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_KEY = 'audit_action';

/**
 * @AuditAction
 * 为路由声明审计 action，供 AuditInterceptor 使用
 */
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
