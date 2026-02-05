import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { RequireSignature } from '../security/api-security/api-security.decorator';

@Controller('storage')
export class StorageController {
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
        return res.status(HttpStatus.OK).json({ storageKey: finalRel, sha256: headerSha.toLowerCase(), size: len, exists: true });
      }
    }

    const tmpPath = path.resolve(storageRoot, `novels/.tmp/${headerSha}.${process.pid}.${Date.now()}.tmp`);
    const out = fs.createWriteStream(tmpPath, { flags: 'wx' });
    const hash = createHash('sha256');
    let bytes = 0;

    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      hash.update(chunk);
    });

    req.pipe(out);

    const cleanup = () => {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { }
    };

    out.on('error', (e) => {
      cleanup();
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'WRITE_FAIL', message: String(e) });
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
          receivedBytes: bytes
        });
      }
      try {
        fs.renameSync(tmpPath, finalPath);
        return res.status(HttpStatus.OK).json({ storageKey: finalRel, sha256: computed, size: bytes, exists: false });
      } catch (err) {
        cleanup();
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'RENAME_FAIL', message: String(err) });
      }
    });
  }
}
