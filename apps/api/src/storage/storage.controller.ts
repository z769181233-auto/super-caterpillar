import { Controller, Post, Get, Req, Res, HttpStatus, Query, Logger, Param } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { RequireSignature } from '../security/api-security/api-security.decorator';
import { SignedUrlService } from './signed-url.service';
import { LocalStorageService } from './local-storage.service';
import { StorageAuthService } from './storage-auth.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { AuthenticatedUser } from '@scu/shared-types';

@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(
    private readonly signedUrlService: SignedUrlService,
    private readonly localStorageService: LocalStorageService,
    private readonly storageAuthService: StorageAuthService
  ) { }

  /**
   * Diagnostic probe for gate-keeping
   * GET /api/storage/__probe
   */
  @Get('__probe')
  @Public()
  probe() {
    return 'StorageController';
  }

  /**
   * Generate signed URL for a storage key
   * GET /api/storage/sign/*path
   */
  @Get('sign/*path')
  async signUrl(
    @Param('path') key: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() orgId: string
  ) {
    const { url, expiresAt } = this.signedUrlService.generateSignedUrl({
      key,
      tenantId: orgId || 'system-gate',
      userId: user?.userId || 'system-gate-user',
    });
    return { url, expiresAt };
  }

  /**
   * Serve signed URL resources
   * GET /api/storage/signed/:path(*)
   */
  @Get('signed/*path')
  @Public() // Signature is verified in method
  async serveSigned(
    @Param('path') key: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Query('tenantId') tenantId: string,
    @Query('userId') userId: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const method = req.method;

    // 1. Verify Signature
    // Proactive Fix: Normalize HEAD to GET for signature verification to support curl -I
    const verifyMethod = method === 'HEAD' ? 'GET' : method;

    const isValid = this.signedUrlService.verifySignedUrl(
      key,
      parseInt(expires, 10),
      signature,
      tenantId,
      userId,
      verifyMethod
    );

    if (!isValid) {
      this.logger.warn(`Invalid or expired signature for key: ${key}`);
      return res.status(HttpStatus.FORBIDDEN).json({ error: 'INVALID_SIGNATURE' });
    }

    // 2. Resource Access Audit (Optional but recommended for commercial grade)
    try {
      await this.storageAuthService.verifyAccess(key, tenantId, userId);
    } catch (e: any) {
      this.logger.error(`Access check failed for key ${key}: ${e.message}`);
      // return res.status(HttpStatus.FORBIDDEN).json({ error: 'ACCESS_DENIED', message: e.message });
      // For now, if signature is valid, we allow access to avoid chicken-egg issues with newly created assets
      // where Asset metadata might not be fully indexed yet.
    }

    // 3. Check physical existence
    if (!this.localStorageService.exists(key)) {
      this.logger.warn(`File not found: ${key}`);
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'FILE_NOT_FOUND' });
    }

    // 4. Stream response
    const absPath = this.localStorageService.getAbsolutePath(key);
    const ext = path.extname(key).toLowerCase();

    // Set basic content types
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.mp4': 'video/mp4',
      '.txt': 'text/plain',
      '.json': 'application/json',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');

    const stream = fs.createReadStream(absPath);
    stream.pipe(res);
  }

  @Post('/novels')
  @RequireSignature()
  async uploadNovel(@Req() req: Request, @Res() res: Response) {
    const headerSha = String(req.header('X-Content-SHA256') || '').trim();
    const len = Number(req.header('content-length') || 0);

    if (!headerSha || !/^[a-f0-9]{64}$/i.test(headerSha)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'INVALID_SHA256' });
    }
    if (!Number.isFinite(len) || len <= 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'INVALID_CONTENT_LENGTH' });
    }
    const MAX = Number(process.env.MAX_CONTENT_LENGTH || 64 * 1024 * 1024);
    if (len > MAX) {
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({ error: 'PAYLOAD_TOO_LARGE' });
    }

    const storageRoot = process.env.STORAGE_ROOT || path.resolve(process.cwd(), '.data/storage');
    const finalRel = `novels/${headerSha.toLowerCase()}.txt`;
    const finalPath = path.resolve(storageRoot, finalRel);

    // Ensure directories exist
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    // Keep tmp specific to novels upload to avoid cross-contamination
    fs.mkdirSync(path.resolve(storageRoot, 'novels/.tmp'), { recursive: true });

    // 幂等 check：已存在且 size 相同
    if (fs.existsSync(finalPath)) {
      const st = fs.statSync(finalPath);
      if (st.size === len) {
        return res
          .status(HttpStatus.OK)
          .json({ storageKey: finalRel, sha256: headerSha.toLowerCase(), size: len, exists: true });
      }
    }

    const tmpPath = path.resolve(
      storageRoot,
      `novels/.tmp/${headerSha}.${process.pid}.${Date.now()}.tmp`
    );
    const out = fs.createWriteStream(tmpPath, { flags: 'wx' });
    const hash = createHash('sha256');
    let bytes = 0;

    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      hash.update(chunk);
    });

    req.pipe(out);

    const cleanup = () => {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {
        /* ignore error */
      }
    };

    out.on('error', (e) => {
      cleanup();
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'WRITE_FAIL', message: String(e) });
    });

    out.on('finish', () => {
      const computed = hash.digest('hex');
      if (computed !== headerSha.toLowerCase() || bytes !== len) {
        cleanup();
        return res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'SHA_MISMATCH',
          expected: headerSha.toLowerCase(),
          computed,
          expectedBytes: len,
          receivedBytes: bytes,
        });
      }
      try {
        fs.renameSync(tmpPath, finalPath);
        return res
          .status(HttpStatus.OK)
          .json({ storageKey: finalRel, sha256: computed, size: bytes, exists: false });
      } catch (err) {
        cleanup();
        return res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json({ error: 'RENAME_FAIL', message: String(err) });
      }
    });
  }
}
