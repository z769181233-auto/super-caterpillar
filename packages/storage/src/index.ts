import * as path from 'path';
import * as fs from 'fs';
import { ReadStream, createReadStream } from 'fs';

export class LocalStorageAdapter {
  private readonly rootPath: string;

  constructor(public readonly root: string) {
    this.rootPath = path.resolve(root);
  }

  private safePath(key: string): string {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('Storage key must be a non-empty string');
    }
    if (path.isAbsolute(key)) {
      throw new Error('Storage key must be relative');
    }

    const normalizedKey = path.normalize(key);
    if (
      normalizedKey === '..' ||
      normalizedKey.startsWith(`..${path.sep}`) ||
      normalizedKey.includes(`${path.sep}..${path.sep}`)
    ) {
      throw new Error('Storage key cannot traverse parent directories');
    }

    const fullPath = path.resolve(this.rootPath, normalizedKey);
    const relative = path.relative(this.rootPath, fullPath);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Storage key resolves outside storage root');
    }
    return fullPath;
  }

  resolve(relativePath: string): string {
    return this.safePath(relativePath);
  }

  getAbsolutePath(key: string): string {
    return this.safePath(key);
  }

  exists(key: string): boolean {
    return fs.existsSync(this.getAbsolutePath(key));
  }

  getReadStream(key: string): ReadStream {
    const fullPath = this.getAbsolutePath(key);
    return createReadStream(fullPath);
  }

  async put(key: string, buffer: Buffer): Promise<void> {
    const fullPath = this.getAbsolutePath(key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, buffer);
  }

  async getBuffer(key: string): Promise<Buffer> {
    return fs.readFileSync(this.getAbsolutePath(key));
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getAbsolutePath(key);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}
