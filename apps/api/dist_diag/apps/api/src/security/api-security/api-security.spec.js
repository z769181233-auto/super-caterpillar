"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/testdb';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
const testing_1 = require("@nestjs/testing");
const api_security_service_1 = require("./api-security.service");
const secret_encryption_service_1 = require("./secret-encryption.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const redis_service_1 = require("../../redis/redis.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const crypto_1 = require("crypto");
describe('ApiSecurityService', () => {
    let service;
    let secretEncryptionService;
    let prismaService;
    let redisService;
    let auditLogService;
    const testMasterKey = (0, crypto_1.randomBytes)(32).toString('base64');
    const mockApiKey = 'ak_test_123';
    const mockSecret = 'test_secret_key';
    const mockNonce = 'nonce_123456';
    let mockTimestamp;
    beforeEach(async () => {
        mockTimestamp = Math.floor(Date.now() / 1000).toString();
        process.env.API_KEY_MASTER_KEY_B64 = testMasterKey;
        const mockPrismaService = {
            $disconnect: jest.fn().mockResolvedValue(undefined),
            apiKey: {
                findUnique: jest.fn(),
                update: jest.fn().mockResolvedValue({}),
            },
        };
        const mockRedisService = {
            get: jest.fn(),
            set: jest.fn(),
        };
        const mockAuditLogService = {
            record: jest.fn().mockResolvedValue({}),
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                api_security_service_1.ApiSecurityService,
                secret_encryption_service_1.SecretEncryptionService,
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: mockPrismaService,
                },
                {
                    provide: redis_service_1.RedisService,
                    useValue: mockRedisService,
                },
                {
                    provide: audit_log_service_1.AuditLogService,
                    useValue: mockAuditLogService,
                },
            ],
        }).compile();
        service = module.get(api_security_service_1.ApiSecurityService);
        secretEncryptionService = module.get(secret_encryption_service_1.SecretEncryptionService);
        prismaService = module.get(prisma_service_1.PrismaService);
        redisService = module.get(redis_service_1.RedisService);
        auditLogService = module.get(audit_log_service_1.AuditLogService);
    });
    afterEach(() => {
        delete process.env.API_KEY_MASTER_KEY_B64;
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    function computeTestSignatureV2(method, pathWithQuery, apiKey, timestamp, nonce, contentSha256, secret, body) {
        const canonicalV2 = service.buildCanonicalStringV2
            ? service.buildCanonicalStringV2(method, pathWithQuery, apiKey, timestamp, nonce, body ?? '', contentSha256)
            : `${apiKey}${nonce}${timestamp}${body ?? ''}`;
        const hmac = (0, crypto_1.createHmac)('sha256', secret);
        hmac.update(canonicalV2, 'utf8');
        return hmac.digest('hex');
    }
    describe('verifySignature', () => {
        it('应该通过正常签名验证（v2，加密存储）', async () => {
            const method = 'POST';
            const pathWithQuery = '/api/test';
            const body = JSON.stringify({ test: 'data' });
            const contentSha256 = service.sha256Hex(body);
            const canonicalV2 = service.buildCanonicalStringV2(method, pathWithQuery, mockApiKey, mockTimestamp, mockNonce, body, contentSha256);
            const signature = service.computeSignature(mockSecret, canonicalV2);
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
                body,
            });
            expect(result.success).toBe(true);
            expect(result.apiKeyId).toBe('key_id_123');
            expect(redisService.set).toHaveBeenCalledWith(`api_security:nonce:${mockApiKey}:${mockNonce}`, mockTimestamp, 300);
        });
        it('应该通过 multipart UNSIGNED 验证（加密存储）', async () => {
            const method = 'POST';
            const pathWithQuery = '/api/projects/123/novel/import-file';
            const contentSha256 = 'UNSIGNED';
            const canonicalV2 = service.buildCanonicalStringV2(method, pathWithQuery, mockApiKey, mockTimestamp, mockNonce, contentSha256);
            const signature = service.computeSignature(mockSecret, canonicalV2);
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
            const expiredTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
            const method = 'POST';
            const pathWithQuery = '/api/test';
            const body = JSON.stringify({ test: 'data' });
            const contentSha256 = service.sha256Hex(body);
            const signature = computeTestSignatureV2(method, pathWithQuery, mockApiKey, expiredTimestamp, mockNonce, contentSha256, mockSecret, body);
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
            const encrypted = secretEncryptionService.encryptSecret(mockSecret);
            const signature = computeTestSignatureV2(method, pathWithQuery, mockApiKey, mockTimestamp, mockNonce, contentSha256, mockSecret, body);
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
            expect(result.errorMessage).toContain('invalid_signature');
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
            const expected = `${apiKey}${nonce}${timestamp}${contentSha256}`;
            expect(canonical).toBe(expected);
        });
        it('应该正确处理 query string', () => {
            const method = 'GET';
            const pathWithQuery = '/api/projects/123/novel/jobs?status=SUCCEEDED&limit=10';
            const apiKey = 'ak_test';
            const timestamp = '1234567890';
            const nonce = 'nonce_123';
            const contentSha256 = '';
            const canonical = service.buildCanonicalStringV2(method, pathWithQuery, apiKey, timestamp, nonce, contentSha256, '');
            const expected = `${apiKey}${nonce}${timestamp}`;
            expect(canonical).toBe(expected);
        });
        it('应该正确处理 multipart UNSIGNED', () => {
            const method = 'POST';
            const pathWithQuery = '/api/projects/123/novel/import-file';
            const apiKey = 'ak_test';
            const timestamp = '1234567890';
            const nonce = 'nonce_123';
            const contentSha256 = 'UNSIGNED';
            const canonical = service.buildCanonicalStringV2(method, pathWithQuery, apiKey, timestamp, nonce, '', contentSha256);
            const expected = `${apiKey}${nonce}${timestamp}UNSIGNED`;
            expect(canonical).toBe(expected);
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
            expect(signature).toMatch(/^[a-f0-9]{64}$/);
            const signature2 = service.computeSignature(secret, message);
            expect(signature).toBe(signature2);
        });
    });
});
//# sourceMappingURL=api-security.spec.js.map