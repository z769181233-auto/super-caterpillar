import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import type { CreateStoredFileInput, StoredFile } from '../../../packages/domain/src';
import { createId } from './id';

function now(): string {
  return new Date().toISOString();
}

function decodeFilename(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return trimmed;
  }

  try {
    return decodeURIComponent(trimmed).normalize('NFKC');
  } catch {
    return trimmed.normalize('NFKC');
  }
}

function sanitizeFilename(name: string): string {
  const safeBase = basename(decodeFilename(name))
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safeBase || 'upload.bin';
}

function resolveStorageRoot(): string {
  return process.env.ANIME_STUDIO_V2_FILE_STORAGE_PATH || resolve(process.cwd(), '../../.runtime/storage');
}

export function storeProjectFile(projectId: string, input: CreateStoredFileInput): StoredFile {
  const buffer = Buffer.from(input.contentBase64, 'base64');
  return storeProjectFileBuffer(projectId, {
    name: input.name,
    kind: input.kind,
    mimeType: input.mimeType,
    buffer
  });
}

export function storeProjectFileBuffer(
  projectId: string,
  input: {
    name: string;
    kind: CreateStoredFileInput['kind'];
    mimeType: string;
    buffer: Buffer;
  }
): StoredFile {
  const fileId = createId('file');
  const safeName = sanitizeFilename(input.name);
  const extension = extname(safeName);
  const finalName = extension ? `${fileId}-${safeName}` : `${fileId}-${safeName}.bin`;
  const projectDir = resolve(resolveStorageRoot(), projectId);
  const absolutePath = resolve(projectDir, finalName);

  mkdirSync(projectDir, { recursive: true });
  writeFileSync(absolutePath, input.buffer);

  return {
    id: fileId,
    projectId,
    name: safeName,
    kind: input.kind,
    mimeType: input.mimeType,
    byteSize: input.buffer.byteLength,
    absolutePath,
    createdAt: now()
  };
}

export function readStoredTextFile(file: StoredFile): string {
  return readFileSync(file.absolutePath, 'utf8');
}
