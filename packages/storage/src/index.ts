import * as fs from 'fs-extra';
import * as path from 'path';
import { ReadStream, createReadStream } from 'fs';
import * as util from 'util';

export class LocalStorageAdapter {
  private root: string;

  constructor(root?: string) {
    if (root) {
      this.root = root;
    } else {
      // Robust detection: prioritize current directory if it contains apps/ or packages/
      const cwd = process.cwd();
      const hasApps = fs.existsSync(path.join(cwd, 'apps'));
      const hasPackages = fs.existsSync(path.join(cwd, 'packages'));

      if (hasApps && hasPackages) {
        this.root = path.resolve(cwd, '.data/storage');
      } else {
        // Fallback to legacy assumption but make it absolute from current file
        this.root = path.resolve(__dirname, '../../../.data/storage');
      }
    }
    fs.ensureDirSync(this.root);
    process.stdout.write(util.format(`[LocalStorageAdapter] Initialized at: ${this.root}`) + '\n');
  }

  /**
   * Write buffer to storage
   * @param key Storage key (e.g., "videos/job-123.mp4")
   * @param buffer Content
   */
  async put(key: string, buffer: Buffer): Promise<void> {
    this.validateKey(key);
    const fullPath = this.getAbsolutePath(key);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, buffer);
  }

  /**
   * Get read stream for key
   * @param key Storage key
   */
  getReadStream(key: string): ReadStream {
    this.validateKey(key);
    const fullPath = this.getAbsolutePath(key);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${key}`);
    }
    return createReadStream(fullPath);
  }

  /**
   * Get absolute local path (Internal/Worker only)
   * @param key Storage key
   */
  getAbsolutePath(key: string): string {
    this.validateKey(key);
    return path.join(this.root, key);
  }

  /**
   * Check if file exists
   */
  exists(key: string): boolean {
    this.validateKey(key);
    return fs.existsSync(this.getAbsolutePath(key));
  }

  /**
   * Validate key to prevent partial traversal
   */
  private validateKey(key: string): void {
    if (key.includes('..') || key.startsWith('/')) {
      throw new Error(`Invalid storage key: ${key}`);
    }
  }
}
