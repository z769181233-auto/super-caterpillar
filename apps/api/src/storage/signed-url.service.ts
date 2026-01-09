import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@scu/config';

export interface SignedUrlOptions {
  key: string;
  tenantId: string; // 租户 ID（必填）
  userId: string; // 用户 ID（必填）
  expiresIn?: number; // 秒，默认 1 小时
  method?: string; // HTTP 方法，默认 GET
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
  signature: string;
}

/**
 * Signed URL 服务
 * 用于生成带签名的下载链接，避免直接暴露存储路径
 */
@Injectable()
export class SignedUrlService {
  private readonly logger = new Logger(SignedUrlService.name);
  private readonly secret: string;
  private readonly defaultExpiresIn: number;
  private readonly baseUrl: string;

  constructor() {
    // 从环境变量读取密钥（如果没有则使用 JWT_SECRET 作为后备）
    this.secret =
      process.env.STORAGE_SIGNED_URL_SECRET ||
      env.jwtSecret ||
      'default-secret-change-in-production';
    this.defaultExpiresIn = parseInt(process.env.STORAGE_SIGNED_URL_TTL || '3600', 10); // 默认 1 小时
    this.baseUrl = process.env.STORAGE_BASE_URL || env.apiUrl || 'http://localhost:3000';

    if (this.secret === 'default-secret-change-in-production') {
      this.logger.warn(
        '[SignedUrlService] Using default secret! Change STORAGE_SIGNED_URL_SECRET in production!'
      );
    }
  }

  /**
   * 生成签名 URL（包含权限绑定）
   */
  generateSignedUrl(options: SignedUrlOptions): SignedUrlResult {
    const { key, tenantId, userId, expiresIn = this.defaultExpiresIn, method = 'GET' } = options;

    // 验证 key 安全性
    if (key.includes('..') || key.startsWith('/')) {
      throw new Error(`Invalid storage key: ${key}`);
    }

    if (!tenantId || !userId) {
      throw new Error('tenantId and userId are required for signed URL generation');
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const expires = Math.floor(expiresAt.getTime() / 1000);

    // 构建签名字符串：method:key:tenantId:userId:expires
    const signString = `${method}:${key}:${tenantId}:${userId}:${expires}`;

    // 生成 HMAC-SHA256 签名
    const signature = createHmac('sha256', this.secret).update(signString).digest('hex');

    // 构建 URL：/api/storage/signed/:key?expires=xxx&tenantId=xxx&userId=xxx&signature=xxx
    const safePathKey = this.encodeKeyAsPath(key);

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[SignedUrlService] key=${key} safePathKey=${safePathKey}`);
    }

    const url = `${this.baseUrl}/api/storage/signed/${safePathKey}?expires=${expires}&tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}&signature=${signature}`;

    return {
      url,
      expiresAt,
      signature,
    };
  }

  /**
   * 验证签名 URL（包含权限验证）
   */
  verifySignedUrl(
    key: string,
    expires: number,
    signature: string,
    tenantId: string,
    userId: string,
    method: string = 'GET'
  ): boolean {
    try {
      // 检查过期时间
      const now = Math.floor(Date.now() / 1000);
      if (expires < now) {
        this.logger.warn(
          `[SignedUrlService] Signed URL expired: key=${key}, expires=${expires}, now=${now}`
        );
        return false;
      }

      // 验证 key 安全性
      if (key.includes('..') || key.startsWith('/')) {
        this.logger.warn(`[SignedUrlService] Invalid key in signed URL: ${key}`);
        return false;
      }

      // 构建签名字符串：method:key:tenantId:userId:expires
      const signString = `${method}:${key}:${tenantId}:${userId}:${expires}`;

      // 计算期望的签名
      const expectedSignature = createHmac('sha256', this.secret).update(signString).digest('hex');

      // 使用 timing-safe comparison 防止时序攻击
      if (signature.length !== expectedSignature.length) {
        return false;
      }

      return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (error) {
      this.logger.error(
        `[SignedUrlService] Error verifying signed URL: ${error.message}`,
        error.stack
      );
      return false;
    }
  }

  /**
   * 批量生成签名 URL（用于批量下载场景）
   */
  generateBatchSignedUrls(
    keys: string[],
    tenantId: string,
    userId: string,
    expiresIn?: number
  ): SignedUrlResult[] {
    return keys.map((key) => this.generateSignedUrl({ key, tenantId, userId, expiresIn }));
  }
  /**
   * 安全编码 key 为路径，保留 / 分隔符
   */
  private encodeKeyAsPath(key: string): string {
    return key
      .split('/')
      .filter((s) => s.length > 0)
      .map((seg) => encodeURIComponent(seg))
      .join('/');
  }
}
