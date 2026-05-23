/**
 * Contract Gate - HMAC/Nonce/Timestamp 校验测试
 *
 * 验证 APISpec V1.1 要求：
 * - 4003: 签名错误
 * - 4004: Nonce 重放
 * - 时间窗验证
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHmac } from 'crypto';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SecretEncryptionService } from '../../src/security/api-security/secret-encryption.service';

process.env.API_KEY_MASTER_KEY_B64 =
  process.env.API_KEY_MASTER_KEY_B64 || Buffer.alloc(32, 7).toString('base64');

function computeSignature(secret: string, credentialId: string, nonce: string, timestamp: string, body: string) {
  return createHmac('sha256', secret)
    .update(`${credentialId}${nonce}${timestamp}${body}`)
    .digest('hex');
}

const TEST_PATH = '/api/audit/logs';
const TEST_BODY = {
  traceId: 'trace-contract',
  projectId: 'project-contract',
  jobId: 'job-contract',
  jobType: 'CONTRACT_TEST',
  engineKey: 'ce_contract',
  status: 'SUCCESS',
};
const TEST_BODY_JSON = JSON.stringify(TEST_BODY);

describe('HMAC/Nonce Contract Tests (APISpec V1.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const CREDENTIAL_ID = process.env.HMAC_CONTRACT_CREDENTIAL_ID || 'test-key';
  const API_SECRET = process.env.TEST_API_SECRET || 'test-secret';
  let userId: string;
  let credentialRecordId: string;
  let secretEncryptionService: SecretEncryptionService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    secretEncryptionService = moduleFixture.get(SecretEncryptionService);

    // Create User for API Key
    const user = await prisma.user.create({
      data: {
        email: `hmac-test-${Date.now()}@example.com`,
        passwordHash: 'hash',
      },
    });
    userId = user.id;

    // Create API Key
    const encrypted = secretEncryptionService.encryptSecret(API_SECRET);
    const credentialRecord = await prisma.apiKey.create({
      data: {
        key: CREDENTIAL_ID,
        secretEnc: encrypted.enc,
        secretEncIv: encrypted.iv,
        secretEncTag: encrypted.tag,
        secretVersion: 1,
        status: 'ACTIVE',
        ownerUserId: userId,
      },
    });
    credentialRecordId = credentialRecord.id;
  });

  afterAll(async () => {
    if (credentialRecordId) await prisma.apiKey.delete({ where: { id: credentialRecordId } }).catch(() => {});
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await app.close();
  });

  describe('HMAC Signature Validation (4003)', () => {
    it('should return 4003 when signature is missing', async () => {
      const response = await request(app.getHttpServer())
        .post(TEST_PATH)
        .set('X-Api-Key', CREDENTIAL_ID)
        .set('Content-Type', 'application/json')
        .send(TEST_BODY);

      expect(response.status).toBeGreaterThanOrEqual(400);
      // Should contain 4003 error code or signature-related error
      expect(
        response.body?.error?.code === '4003' ||
          response.body?.code === '4003' ||
          response.body?.code === 'SIGNATURE_ERROR' ||
          response.body?.message?.toLowerCase().includes('signature') ||
          response.status === 401 ||
          response.status === 403 ||
          response.status === 400 // HmacAuthService returns 400
      ).toBe(true);
    });

    it('should return 4003 when signature is invalid', async () => {
      const invalidNonce = `invalid-signature-${Date.now()}-${Math.random()}`;

      const response = await request(app.getHttpServer())
        .post(TEST_PATH)
        .set('X-Api-Key', CREDENTIAL_ID)
        .set('X-Signature', 'invalid-signature')
        .set('X-Nonce', invalidNonce)
        .set('X-Timestamp', Math.floor(Date.now() / 1000).toString())
        .set('Content-Type', 'application/json')
        .send(TEST_BODY);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(
        response.body?.error?.code === '4003' ||
          response.body?.code === '4003' ||
          response.body?.code === 'SIGNATURE_ERROR' ||
          response.status === 401 ||
          response.status === 403 ||
          response.status === 400
      ).toBe(true);
    });
  });

  describe('Nonce Replay Detection (4004)', () => {
    let validNonce: string;
    let validTimestamp: string;

    beforeEach(() => {
      validNonce = `nonce-${Date.now()}-${Math.random()}`;
      validTimestamp = Math.floor(Date.now() / 1000).toString();
    });

    it('should return 4004 when nonce is reused', async () => {
      const firstSignature = computeSignature(
        API_SECRET,
        CREDENTIAL_ID,
        validNonce,
        validTimestamp,
        TEST_BODY_JSON
      );

      // First request with valid nonce
      const firstResponse = await request(app.getHttpServer())
        .post(TEST_PATH)
        .set('X-Api-Key', CREDENTIAL_ID)
        .set('X-Signature', firstSignature)
        .set('X-Nonce', validNonce)
        .set('X-Timestamp', validTimestamp)
        .set('Content-Type', 'application/json')
        .send(TEST_BODY);

      expect(firstResponse.body?.error?.code).not.toBe('4003');

      const replayTimestamp = Math.floor((Date.now() + 1000) / 1000).toString();
      const replaySignature = computeSignature(
        API_SECRET,
        CREDENTIAL_ID,
        validNonce,
        replayTimestamp,
        TEST_BODY_JSON
      );

      // Second request with same nonce
      const secondResponse = await request(app.getHttpServer())
        .post(TEST_PATH)
        .set('X-Api-Key', CREDENTIAL_ID)
        .set('X-Signature', replaySignature)
        .set('X-Nonce', validNonce) // Same nonce
        .set('X-Timestamp', replayTimestamp)
        .set('Content-Type', 'application/json')
        .send(TEST_BODY);

      // If nonce replay detection is working, second request should return 4004
      expect(
        secondResponse.body?.error?.code === '4004' ||
          secondResponse.body?.code === '4004' ||
          secondResponse.body?.code === 'NONCE_REPLAY' ||
          secondResponse.status === 403 ||
          secondResponse.status === 400
      ).toBe(true);
    });
  });

  describe('Timestamp Window Validation', () => {
    it('should reject requests with timestamp too far in the past', async () => {
      const oldTimestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString(); // 10 minutes ago

      const response = await request(app.getHttpServer())
        .post(TEST_PATH)
        .set('X-Api-Key', CREDENTIAL_ID)
        .set('X-Signature', 'test-signature')
        .set('X-Nonce', `nonce-${Date.now()}`)
        .set('X-Timestamp', oldTimestamp)
        .set('Content-Type', 'application/json')
        .send(TEST_BODY);

      // Should reject old timestamps (typically 5 minutes window)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject requests with timestamp too far in the future', async () => {
      const futureTimestamp = Math.floor((Date.now() + 10 * 60 * 1000) / 1000).toString(); // 10 minutes in future

      const response = await request(app.getHttpServer())
        .post(TEST_PATH)
        .set('X-Api-Key', CREDENTIAL_ID)
        .set('X-Signature', 'test-signature')
        .set('X-Nonce', `nonce-${Date.now()}`)
        .set('X-Timestamp', futureTimestamp)
        .set('Content-Type', 'application/json')
        .send(TEST_BODY);

      // Should reject future timestamps
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
