
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
        // 路径权威规则:优先使用 REPO_ROOT,否则使用 STORAGE_ROOT,最后使用 cwd 推导
        let storageRoot: string;
        if (process.env.REPO_ROOT) {
            storageRoot = path.join(process.env.REPO_ROOT, '.data/storage');
        } else if (process.env.STORAGE_ROOT) {
            storageRoot = process.env.STORAGE_ROOT;
        } else {
            // Fallback: API runs from apps/api, go up two levels to project root
            const repoRoot = path.resolve(process.cwd(), '../..');
            storageRoot = path.join(repoRoot, '.data/storage');
            console.warn('[LocalStorageService] Using cwd fallback. STORAGE_ROOT not found.');
        }

        // Dev-only: Print final storage root for debugging
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Storage] root=${path.resolve(storageRoot)}`);
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
