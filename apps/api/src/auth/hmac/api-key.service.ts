import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { SecretEncryptionService } from '../../security/api-security/secret-encryption.service';

/**
 * API Key 管理服务
 * 提供 API Key 的创建、查询、禁用等基础功能
 *
 * 注意：这是最小可用版，生产环境需要：
 * 1. 使用加密存储 secret（而非明文）
 * 2. 提供完整的 API Key 管理界面
 * 3. 支持权限范围限制
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly secretEncryptionService: SecretEncryptionService
  ) {}

  private stripSensitiveFields<T extends Record<string, any>>(record: T | null | undefined) {
    if (!record) {
      return record ?? null;
    }
    const sanitized = { ...record };
    delete sanitized.secretEnc;
    delete sanitized.secretEncIv;
    delete sanitized.secretEncTag;
    return sanitized;
  }

  /**
   * 生成 API Key
   * @returns { key: string, secret: string } - 返回公钥和密钥（密钥只显示一次）
   */
  private generateApiKey(): { key: string; secret: string } {
    // 生成公钥 ID（格式：ak_xxx）
    const keyId = `ak_${randomBytes(16).toString('hex')}`;

    // 生成密钥（32 字节，64 字符的十六进制字符串）
    const secret = randomBytes(32).toString('hex');

    return { key: keyId, secret };
  }

  /**
   * 创建 API Key
   * @param userId 用户 ID（可选）
   * @param orgId 组织 ID（可选）
   * @param name API Key 名称（可选）
   * @returns 创建的 API Key 记录（包含 key 和 secret，secret 只返回一次）
   */
  async createApiKey(userId?: string, orgId?: string, name?: string) {
    const { key, secret } = this.generateApiKey();

    if (!this.secretEncryptionService.isMasterKeyConfigured()) {
      throw new BadRequestException('API_KEY_MASTER_KEY_B64 is required for API key creation.');
    }

    let secretEnc: string;
    let secretEncIv: string;
    let secretEncTag: string;
    let secretVersion: number;

    try {
      const encrypted = this.secretEncryptionService.encryptSecret(secret);
      secretEnc = encrypted.enc;
      secretEncIv = encrypted.iv;
      secretEncTag = encrypted.tag;
      secretVersion = 1;
    } catch (error: any) {
      this.logger.error(`Failed to secure API secret: ${error.message}`);
      throw new BadRequestException('Failed to secure API secret for storage.');
    }

    const apiKey = await (this.prisma as any).apiKey.create({
      data: {
        key,
        secretEnc,
        secretEncIv,
        secretEncTag,
        secretVersion,
        name,
        ownerUserId: userId,
        ownerOrgId: orgId,
        status: 'ACTIVE',
      },
    });

    // 返回包含 secret 的记录（secret 只返回一次，客户端应保存）
    // ⚠️ 禁止在任何地方写日志输出 secret 明文
    const result = {
      ...apiKey,
      secret, // 只返回一次，客户端应保存
    };

    return this.stripSensitiveFields(result);
  }

  /**
   * 根据 key 查找 API Key 记录
   */
  async findByKey(key: string) {
    const record = await (this.prisma as any).apiKey.findUnique({
      where: { key },
      include: {
        ownerUser: true,
        ownerOrg: true,
      },
    });
    return this.stripSensitiveFields(record);
  }

  /**
   * 禁用 API Key
   */
  async disableApiKey(key: string) {
    const apiKey = await this.findByKey(key);
    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }

    return (this.prisma as any).apiKey.update({
      where: { key },
      data: { status: 'DISABLED' },
    });
  }

  /**
   * 启用 API Key
   */
  async enableApiKey(key: string) {
    const apiKey = await this.findByKey(key);
    if (!apiKey) {
      throw new NotFoundException('API Key 不存在');
    }

    return (this.prisma as any).apiKey.update({
      where: { key },
      data: { status: 'ACTIVE' },
    });
  }

  /**
   * 列出用户的 API Key
   */
  async listApiKeys(userId?: string, orgId?: string) {
    const where: any = {};
    if (userId) {
      where.ownerUserId = userId;
    }
    if (orgId) {
      where.ownerOrgId = orgId;
    }

    const records = await (this.prisma as any).apiKey.findMany({
      where,
      include: {
        ownerUser: {
          select: { id: true, email: true },
        },
        ownerOrg: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record: Record<string, any>) => this.stripSensitiveFields(record));
  }
}
