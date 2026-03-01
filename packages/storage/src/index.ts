import * as path from 'path';
import * as fs from 'fs';
import { ReadStream, createReadStream } from 'fs';

export class LocalStorageAdapter {
  constructor(public readonly root: string) { }

  resolve(relativePath: string): string {
    return path.join(this.root, relativePath);
  }

  getAbsolutePath(key: string): string {
    return path.join(this.root, key);
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
