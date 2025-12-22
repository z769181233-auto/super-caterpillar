import { Test, TestingModule } from '@nestjs/testing';
import { ApiSecurityService } from './api-security.service';
import { SecretEncryptionService } from './secret-encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { createHmac, randomBytes } from 'crypto';

describe('ApiSecurityService', () => {
  let service: ApiSecurityService;
  let secretEncryptionService: SecretEncryptionService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let auditLogService: jest.Mocked<AuditLogService>;
  
  // 测试用的主密钥（32 bytes base64）
  const testMasterKey = randomBytes(32).toString('base64');

  const mockApiKey = 'ak_test_123';
  const mockSecret = 'test_secret_key';
  const mockNonce = 'nonce_123456';
  const mockTimestamp = Math.floor(Date.now() / 1000).toString();

  beforeEach(async () => {
    // 设置测试用的主密钥
    process.env.API_KEY_MASTER_KEY_B64 = testMasterKey;

    const mockPrismaService = {
      apiKey: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockAuditLogService = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiSecurityService,
        SecretEncryptionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<ApiSecurityService>(ApiSecurityService);
    secretEncryptionService = module.get<SecretEncryptionService>(SecretEncryptionService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
    auditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    // 清理环境变量
    delete process.env.API_KEY_MASTER_KEY_B64;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 计算签名 v2（用于测试）
   */
  function computeTestSignatureV2(
    method: string,
    pathWithQuery: string,
    apiKey: string,
    timestamp: string,
    nonce: string,
    contentSha256: string,
    secret: string,
  ): string {
    const canonicalString = `v2\n${method}\n${pathWithQuery}\n${apiKey}\n${timestamp}\n${nonce}\n${contentSha256}\n`;
    const hmac = createHmac('sha256', secret);
    hmac.update(canonicalString, 'utf8');
    return hmac.digest('hex');
  }

  describe('verifySignature', () => {
    it('应该通过正常签名验证（v2，加密存储）', async () => {
      const method = 'POST';
      const pathWithQuery = '/api/test';
      const body = JSON.stringify({ test: 'data' });
      const contentSha256 = service.sha256Hex(body);
      const canonicalV2 = service.buildCanonicalStringV2(method, pathWithQuery, mockApiKey, mockTimestamp, mockNonce, contentSha256);
      const signature = service.computeSignature(mockSecret, canonicalV2);

      // 加密 secret
      const encrypted = secretEncryptionService.encryptSecret(mockSecret);

      prismaService.apiKey.findUnique = jest.fn().mockResolvedValue({
        id: 'key_id_123',
        key: mockApiKey,
        secretEnc: encrypted.enc,
        secretEncIv: encrypted.iv,
        secretEncTag: encrypted.tag,
        secretVersion: 1,
        status: 'ACTIVE',
        expiresAt: null,
      });

      redisService.get = jest.fn().mockResolvedValue(null); // Nonce 不存在
      redisService.set = jest.fn().mockResolvedValue(true);
      prismaService.apiKey.update = jest.fn().mockResolvedValue({});

      const result = await service.verifySignature({
        apiKey: mockApiKey,
        nonce: mockNonce,
        timestamp: mockTimestamp,
        signature,
        method,
        path: pathWithQuery,
        contentSha256,
        body,
      });

      expect(result.success).toBe(true);
      expect(result.apiKeyId).toBe('key_id_123');
      expect(redisService.set).toHaveBeenCalledWith(
        `api_security:nonce:${mockApiKey}:${mockNonce}`,
        mockTimestamp,
        300,
      );
    });

    it('应该通过 multipart UNSIGNED 验证（加密存储）', async () => {
      const method = 'POST';
      const pathWithQuery = '/api/projects/123/novel/import-file';
      const contentSha256 = 'UNSIGNED';
      const canonicalV2 = service.buildCanonicalStringV2(method, pathWithQuery, mockApiKey, mockTimestamp, mockNonce, contentSha256);
      const signature = service.computeSignature(mockSecret, canonicalV2);

      // 加密 secret
      const encrypted = secretEncryptionService.encryptSecret(mockSecret);

      prismaService.apiKey.findUnique = jest.fn().mockResolvedValue({
        id: 'key_id_123',
        key: mockApiKey,
        secretEnc: encrypted.enc,
        secretEncIv: encrypted.iv,
        secretEncTag: encrypted.tag,
        secretVersion: 1,
        status: 'ACTIVE',
        expiresAt: null,
      });

      redisService.get = jest.fn().mockResolvedValue(null);
      redisService.set = jest.fn().mockResolvedValue(true);
      prismaService.apiKey.update = jest.fn().mockResolvedValue({});

      const result = await service.verifySignature({
        apiKey: mockApiKey,
        nonce: mockNonce,
        timestamp: mockTimestamp,
        signature,
        method,
        path: pathWithQuery,
        contentSha256,
      });

      expect(result.success).toBe(true);
    });

    it('应该拒绝时间戳过期的请求', async () => {
      const expiredTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 超过 5 分钟
      const method = 'POST';
      const pathWithQuery = '/api/test';
      const body = JSON.stringify({ test: 'data' });
      const contentSha256 = service.sha256Hex(body);
      const signature = computeTestSignatureV2(method, pathWithQuery, mockApiKey, expiredTimestamp, mockNonce, contentSha256, mockSecret);

      prismaService.apiKey.findUnique = jest.fn().mockResolvedValue({
        id: 'key_id_123',
        key: mockApiKey,
        secretHash: mockSecret,
        status: 'ACTIVE',
        expiresAt: null,
      });

      const result = await service.verifySignature({
        apiKey: mockApiKey,
        nonce: mockNonce,
        timestamp: expiredTimestamp,
        signature,
        method,
        path: pathWithQuery,
        contentSha256,
        body,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('4003');
      expect(result.errorMessage).toContain('时间戳超出允许范围');
    });

    it('应该拒绝 Nonce 重放攻击', async () => {
      const method = 'POST';
      const pathWithQuery = '/api/test';
      const body = JSON.stringify({ test: 'data' });
      const contentSha256 = service.sha256Hex(body);
      const signature = computeTestSignatureV2(method, pathWithQuery, mockApiKey, mockTimestamp, mockNonce, contentSha256, mockSecret);

      prismaService.apiKey.findUnique = jest.fn().mockResolvedValue({
        id: 'key_id_123',
        key: mockApiKey,
        secretHash: mockSecret,
        status: 'ACTIVE',
        expiresAt: null,
      });

      // 第一次请求：Nonce 不存在
      redisService.get = jest.fn().mockResolvedValueOnce(null);
      redisService.set = jest.fn().mockResolvedValueOnce(true);

      const firstResult = await service.verifySignature({
        apiKey: mockApiKey,
        nonce: mockNonce,
        timestamp: mockTimestamp,
        signature,
        method,
        path: pathWithQuery,
        contentSha256,
        body,
      });

      expect(firstResult.success).toBe(true);

      // 第二次请求：Nonce 已存在（重放）
      redisService.get = jest.fn().mockResolvedValueOnce(mockTimestamp);

      const secondResult = await service.verifySignature({
        apiKey: mockApiKey,
        nonce: mockNonce,
        timestamp: mockTimestamp,
        signature,
        method,
        path: pathWithQuery,
        contentSha256,
        body,
      });

      expect(secondResult.success).toBe(false);
      expect(secondResult.errorCode).toBe('4004');
      expect(secondResult.errorMessage).toContain('Nonce 已被使用');
    });

    it('应该拒绝签名错误的请求', async () => {
      const method = 'POST';
      const pathWithQuery = '/api/test';
      const body = JSON.stringify({ test: 'data' });
      const contentSha256 = service.sha256Hex(body);
      const wrongSignature = 'wrong_signature_123';

      prismaService.apiKey.findUnique = jest.fn().mockResolvedValue({
        id: 'key_id_123',
        key: mockApiKey,
        secretHash: mockSecret,
        status: 'ACTIVE',
        expiresAt: null,
      });

      redisService.get = jest.fn().mockResolvedValue(null);
      redisService.set = jest.fn().mockResolvedValue(true);

      const result = await service.verifySignature({
        apiKey: mockApiKey,
        nonce: mockNonce,
        timestamp: mockTimestamp,
        signature: wrongSignature,
        method,
        path: pathWithQuery,
        contentSha256,
        body,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('4003');
      expect(result.errorMessage).toContain('签名验证失败');
    });

    it('应该拒绝无效的 API Key', async () => {
      prismaService.apiKey.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.verifySignature({
        apiKey: 'invalid_key',
        nonce: mockNonce,
        timestamp: mockTimestamp,
        signature: 'signature',
        method: 'POST',
        path: '/api/test',
        contentSha256: '',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('4003');
      expect(result.errorMessage).toContain('无效的 API Key');
    });

    it('应该拒绝被禁用的 API Key', async () => {
      prismaService.apiKey.findUnique = jest.fn().mockResolvedValue({
        id: 'key_id_123',
        key: mockApiKey,
        secretHash: mockSecret,
        status: 'DISABLED',
        expiresAt: null,
      });

      const result = await service.verifySignature({
        apiKey: mockApiKey,
        nonce: mockNonce,
        timestamp: mockTimestamp,
        signature: 'signature',
        method: 'POST',
        path: '/api/test',
        contentSha256: '',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('4003');
      expect(result.errorMessage).toContain('API Key 已被禁用');
    });
  });

  describe('buildCanonicalStringV2', () => {
    it('应该正确构建 v2 规范字符串', () => {
      const method = 'POST';
      const pathWithQuery = '/api/projects/123/novel/import?foo=bar';
      const apiKey = 'ak_test';
      const timestamp = '1234567890';
      const nonce = 'nonce_123';
      const contentSha256 = 'a1b2c3d4...';

      const canonical = service.buildCanonicalStringV2(method, pathWithQuery, apiKey, timestamp, nonce, contentSha256);
      const expected = `v2\n${method}\n${pathWithQuery}\n${apiKey}\n${timestamp}\n${nonce}\n${contentSha256}\n`;
      expect(canonical).toBe(expected);
    });

    it('应该正确处理 query string', () => {
      const method = 'GET';
      const pathWithQuery = '/api/projects/123/novel/jobs?status=SUCCEEDED&limit=10';
      const apiKey = 'ak_test';
      const timestamp = '1234567890';
      const nonce = 'nonce_123';
      const contentSha256 = '';

      const canonical = service.buildCanonicalStringV2(method, pathWithQuery, apiKey, timestamp, nonce, contentSha256);
      expect(canonical).toContain(pathWithQuery);
      expect(canonical).toContain('status=SUCCEEDED');
      expect(canonical).toContain('limit=10');
    });

    it('应该正确处理 multipart UNSIGNED', () => {
      const method = 'POST';
      const pathWithQuery = '/api/projects/123/novel/import-file';
      const apiKey = 'ak_test';
      const timestamp = '1234567890';
      const nonce = 'nonce_123';
      const contentSha256 = 'UNSIGNED';

      const canonical = service.buildCanonicalStringV2(method, pathWithQuery, apiKey, timestamp, nonce, contentSha256);
      expect(canonical).toContain('UNSIGNED');
      expect(canonical.endsWith('UNSIGNED\n')).toBe(true);
    });
  });

  describe('sha256Hex', () => {
    it('应该正确计算 SHA256 哈希', () => {
      const data = 'test data';
      const hash = service.sha256Hex(data);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('应该正确处理 Buffer', () => {
      const data = Buffer.from('test data', 'utf8');
      const hash = service.sha256Hex(data);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('buildCanonicalString (v1, deprecated)', () => {
    it('应该正确构建规范字符串（v1 兼容）', () => {
      const apiKey = 'ak_test';
      const nonce = 'nonce_123';
      const timestamp = '1234567890';
      const body = '{"test":"data"}';

      const canonical = service.buildCanonicalString(apiKey, nonce, timestamp, body);
      expect(canonical).toBe(`${apiKey}${nonce}${timestamp}${body}`);
    });
  });

  describe('computeSignature', () => {
    it('应该正确计算 HMAC-SHA256 签名', () => {
      const secret = 'test_secret';
      const message = 'test_message';

      const signature = service.computeSignature(secret, message);

      // 验证签名格式（64 字符的十六进制字符串）
      expect(signature).toMatch(/^[a-f0-9]{64}$/);

      // 验证签名一致性（相同输入应产生相同签名）
      const signature2 = service.computeSignature(secret, message);
      expect(signature).toBe(signature2);
    });
  });
});

