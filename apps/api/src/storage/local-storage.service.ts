
import { Injectable, Logger } from '@nestjs/common';
import { LocalStorageAdapter } from '@scu/storage';
import * as path from 'path';

/**
 * Stage 8: Local Storage Service
 * Wraps @scu/storage LocalStorageAdapter
 */
@Injectable()
export class LocalStorageService {
    private readonly logger = new Logger(LocalStorageService.name);
    public readonly adapter: LocalStorageAdapter;

    constructor() {
        // 路径权威规则：优先使用 REPO_ROOT，否则使用 STORAGE_ROOT，禁止 process.cwd() 推导
        let storageRoot: string;
        if (process.env.REPO_ROOT) {
            storageRoot = path.join(process.env.REPO_ROOT, '.data/storage');
        } else if (process.env.STORAGE_ROOT) {
            storageRoot = process.env.STORAGE_ROOT;
        } else {
            // 兜底：API 从 apps/api 运行，向上两级到项目根目录
            const repoRoot = path.resolve(process.cwd(), '../..');
            storageRoot = path.join(repoRoot, '.data/storage');
        }
        this.logger.log(`Initializing Storage Adapter at: ${storageRoot}`);
        this.adapter = new LocalStorageAdapter(storageRoot);
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
