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
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {}

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

    // CE10 v2: 使用 AES-256-GCM 加密存储 secret
    let secretEnc: string | undefined;
    let secretEncIv: string | undefined;
    let secretEncTag: string | undefined;
    let secretVersion: number | undefined;
    let secretHash: string | undefined;

    try {
      // 尝试加密存储（如果主密钥已配置）
      if (this.secretEncryptionService.isMasterKeyConfigured()) {
        const encrypted = this.secretEncryptionService.encryptSecret(secret);
        secretEnc = encrypted.enc;
        secretEncIv = encrypted.iv;
        secretEncTag = encrypted.tag;
        secretVersion = 1;
        // 不存储 secretHash（新字段优先）
      } else {
        // 主密钥未配置：仅 dev/test 允许 fallback
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
          throw new BadRequestException(
            'API_KEY_MASTER_KEY_B64 is required in production environment. ' +
            'Please configure the master key before creating API keys.',
          );
        }
        // dev/test: 使用旧字段（fallback）
        this.logger.warn(
          'API_KEY_MASTER_KEY_B64 not configured. Using insecure secretHash storage (dev/test only).',
        );
        secretHash = secret;
      }
    } catch (error: any) {
      // 加密失败：如果是生产环境，拒绝；否则 fallback
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        // 脱敏错误消息，详细错误记录到日志
        this.logger.error(`Failed to encrypt secret: ${error.message}`, error.stack);
        throw new BadRequestException(
          'Failed to encrypt secret. Production environment requires encrypted storage.',
        );
      }
      // dev/test: fallback
      this.logger.warn(`Failed to encrypt secret, using fallback: ${error.message}`);
      secretHash = secret;
    }

    const apiKey = await (this.prisma as any).apiKey.create({
      data: {
        key,
        secretHash, // 仅 dev/test fallback 使用
        secretEnc, // 新字段（优先）
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
    
    // 从返回结果中删除敏感字段（避免意外泄露）
    delete (result as any).secretHash;
    delete (result as any).secretEnc;
    delete (result as any).secretEncIv;
    delete (result as any).secretEncTag;
    
    return result;
  }

  /**
   * 根据 key 查找 API Key 记录
   */
  async findByKey(key: string) {
    return (this.prisma as any).apiKey.findUnique({
      where: { key },
      include: {
        ownerUser: true,
        ownerOrg: true,
      },
    });
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

    return (this.prisma as any).apiKey.findMany({
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
  }
}











