import { Injectable, Logger } from '@nestjs/common';
import { LocalStorageAdapter } from '@scu/storage';
import * as path from 'path';
import * as fs from 'fs';

import { config } from '@scu/config';

/**
 * Stage 8: Local Storage Service
 * Wraps @scu/storage LocalStorageAdapter
 */
@Injectable()
export class LocalStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  public readonly adapter: LocalStorageAdapter;

  constructor() {
    const storageRoot = config.storageRoot;
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

  /**
   * Read file content as string
   * [P6-0 Fix] Support for resolving stored payloads
   */
  async readString(key: string): Promise<string> {
    const absPath = this.adapter.getAbsolutePath(key);
    const content = await fs.promises.readFile(absPath, 'utf8');
    this.logger.log(`[STORAGE_DEBUG] Read key=${key} from absPath=${absPath} length=${content.length}`);
    return content;
  }
}
