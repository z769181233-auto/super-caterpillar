import type { PrismaClient } from 'database';
import type { WorkerJobBase as WorkerJob } from '@scu/shared-types';
import type { ApiClient } from '../api-client';
import { LocalStorageAdapter } from '@scu/storage';

export type ProcessorContext = {
  prisma: PrismaClient;
  job: WorkerJob & { [key: string]: any };
  logger?: any;

  /**
   * Gate/Worker 都需要调用 API 进行 Job 管理。
   * 统一设为必需以对齐各端契约。
   */
  apiClient: ApiClient;
  workerId?: string;

  /**
   * [P6-0 Fix] Storage Adapter for resolving novelRef locally
   */
  localStorage?: LocalStorageAdapter;
};
