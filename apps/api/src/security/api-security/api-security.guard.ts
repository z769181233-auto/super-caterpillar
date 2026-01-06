import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiSecurityService } from './api-security.service';
import { REQUIRE_SIGNATURE_KEY } from './api-security.decorator';
import { buildHmacError } from '../../common/utils/hmac-error.utils';
import { RequestWithApiSecurity } from './api-security.types';

/**
 * API Security Guard
 * 
 * 只对标记了 @RequireSignature() 的端点生效
 * 
 * 功能：
 * 1. 检查请求头（X-Api-Key, X-Nonce, X-Timestamp, X-Signature）
 * 2. 调用 ApiSecurityService 验证签名
 * 3. 验证失败时抛出带错误码的异常
 * 
 * 参考文档：
 * - 《10毛毛虫宇宙_API设计规范_APISpec_V1.1》
 */
@Injectable()
export class ApiSecurityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiSecurityService: ApiSecurityService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否标记了 @RequireSignature()
    const requireSignature = this.reflector.getAllAndOverride<boolean>(REQUIRE_SIGNATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 如果未标记，直接通过（不强制签名）
    if (!requireSignature) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithApiSecurity>();
    const method = request.method;
    // v2: 包含 query string 的完整路径
    const pathWithQuery = request.url || request.path || '';
    const path = request.path || request.url?.split('?')[0] || '';

    // 1. 提取请求头（v2 规范）
    const apiKey = request.headers['x-api-key'] as string;
    const nonce = request.headers['x-nonce'] as string;
    const timestamp = request.headers['x-timestamp'] as string;
    const contentSha256 = request.headers['x-content-sha256'] as string;
    const signature = request.headers['x-signature'] as string;

    // 2. 检查必需的头字段
    if (!apiKey || !nonce || !timestamp || !contentSha256 || !signature) {
      throw buildHmacError('4003', 'Missing required security headers (X-Api-Key, X-Nonce, X-Timestamp, X-Content-SHA256, X-Signature)', {
        path,
        method,
      });
    }

    // 3. 判断是否为 multipart 端点（import-file）
    // 注意：使用 pathWithQuery 判断，但匹配时不包含 query string
    const isMultipartEndpoint = method === 'POST' && pathWithQuery.match(/^\/api\/projects\/[^/]+\/novel\/import-file(\?.*)?$/);

    let finalContentSha256 = contentSha256;

    if (isMultipartEndpoint) {
      // multipart 端点：强制要求 X-Content-SHA256=UNSIGNED
      if (contentSha256 !== 'UNSIGNED') {
        throw buildHmacError('4003', 'Multipart endpoint requires X-Content-SHA256=UNSIGNED', {
          path,
          method,
        });
      }
      finalContentSha256 = 'UNSIGNED';
    } else {
      // JSON 请求：验证 contentSha256 格式（必须是 hex 或 UNSIGNED）
      // 当前实现信任客户端提供的 contentSha256
      // 未来可以添加服务端计算并对比的验证
      if (contentSha256 && contentSha256 !== 'UNSIGNED' && !/^[a-f0-9]{64}$/.test(contentSha256)) {
        throw buildHmacError('4003', 'Invalid X-Content-SHA256 format (must be hex or UNSIGNED)', {
          path,
          method,
        });
      }
    }

    // 4. 获取原始 body bytes（用于计算 SHA256，如果未提供且非 multipart）
    let rawBodyBytes: Buffer | undefined;
    if (!isMultipartEndpoint) {
      // 非 multipart 端点：尝试获取 rawBody 或从 body 序列化
      if (request.rawBody) {
        rawBodyBytes = Buffer.isBuffer(request.rawBody)
          ? request.rawBody
          : Buffer.from(request.rawBody);
      } else if (request.body) {
        // 如果没有 rawBody，从 body 对象序列化
        rawBodyBytes = Buffer.from(JSON.stringify(request.body), 'utf8');
      }

      // 如果客户端未提供 contentSha256，且我们有 rawBodyBytes，则计算（兜底）
      // 注意：当前实现要求客户端必须提供 X-Content-SHA256，此处仅作为兜底
      if (!finalContentSha256 && rawBodyBytes) {
        finalContentSha256 = this.apiSecurityService.sha256Hex(rawBodyBytes);
      }
    }

    // 5. 调用服务验证签名（v2）
    const result = await this.apiSecurityService.verifySignature({
      apiKey,
      nonce,
      timestamp,
      signature,
      method,
      path: pathWithQuery, // v2: 包含 query string
      contentSha256: finalContentSha256,
      body: rawBodyBytes ? rawBodyBytes.toString('utf8') : undefined, // 兼容字段
      ip: request.ip || (request.headers['x-forwarded-for'] as string) || undefined,
      userAgent: request.headers['user-agent'] || undefined,
    });

    // 5. 验证失败，抛出异常
    if (!result.success) {
      // 确保错误码符合规范（4003/4004）
      const errorCode = (result.errorCode === '4004' ? '4004' : '4003') as '4003' | '4004';
      throw buildHmacError(
        errorCode,
        result.errorMessage || '签名验证失败',
        { path, method },
      );
    }

    // 6. 验证成功，将 API Key 信息附加到请求对象
    request.apiKey = result.apiKey;
    request.apiKeyId = result.apiKeyId;

    return true;
  }
}

