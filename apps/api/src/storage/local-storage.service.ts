import { Injectable, Logger } from '@nestjs/common';
import { LocalStorageAdapter } from '@scu/storage';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Stage 8: Local Storage Service
 * Wraps @scu/storage LocalStorageAdapter
 */
@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  public readonly adapter: LocalStorageAdapter;

  constructor() {
    // 路径权威规则:优先使用 REPO_ROOT,否则使用 STORAGE_ROOT,最后使用 cwd 推导
    let storageRoot: string;
    if (process.env.REPO_ROOT) {
      storageRoot = path.join(process.env.REPO_ROOT, '.data/storage');
    } else if (process.env.STORAGE_ROOT) {
      storageRoot = process.env.STORAGE_ROOT;
    } else {
      // Robust detection: prioritize current directory if it contains apps/ and packages/
      const cwd = process.cwd();
      const hasApps = fs.existsSync(path.join(cwd, 'apps'));
      const hasPackages = fs.existsSync(path.join(cwd, 'packages'));

      let repoRoot = cwd;
      if (hasApps && hasPackages) {
        repoRoot = cwd;
        this.logger.log(`Confirmed monorepo root at: ${repoRoot}`);
      } else {
        // Fallback: API runs from apps/api, go up two levels to project root
        repoRoot = path.resolve(cwd, '../..');
        this.logger.warn(`Fallback to parent-parent repo root: ${repoRoot}`);
      }
      storageRoot = path.join(repoRoot, '.data/storage');
    }

    // Dev-only: Print final storage root for debugging
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`root=${path.resolve(storageRoot)}`);
    }

    this.logger.log(`Initializing Storage Adapter at: ${storageRoot}`);
    this.adapter = new LocalStorageAdapter(storageRoot);
  }

  /**
   * Get absolute path (for debugging)
   */
  getAbsolutePath(key: string): string {
    return this.adapter.getAbsolutePath(key);
  }

  /**
   * Get read stream for key
   */
  getReadStream(key: string) {
    return this.adapter.getReadStream(key);
  }

  /**
   * Check existence
   */
  exists(key: string) {
    return this.adapter.exists(key);
  }
}
