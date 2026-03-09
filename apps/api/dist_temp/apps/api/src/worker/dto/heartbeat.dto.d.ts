import { WorkerStatus } from 'database';
export declare class HeartbeatDto {
    status?: WorkerStatus;
    tasksRunning?: number;
    temperature?: number;
    capabilities?: any;
    cpuUsagePercent?: number;
    memoryUsageMb?: number;
    queueDepth?: number;
    avgProcessingTimeMs?: number;
    metadata?: Record<string, any>;
}
