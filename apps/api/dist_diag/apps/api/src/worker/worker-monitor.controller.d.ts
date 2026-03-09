import { WorkerService } from './worker.service';
export declare class WorkerMonitorController {
    private readonly workerService;
    constructor(workerService: WorkerService);
    getStats(): Promise<{
        success: boolean;
        data: {
            total: number;
            online: number;
            offline: number;
            idle: number;
            busy: number;
            workers: {
                id: any;
                status: any;
                capabilities: any;
                isOnline: boolean;
                lastHeartbeat: any;
                tasksRunning: any;
                createdAt: any;
                updatedAt: any;
                currentEngineKey: string | null;
            }[];
        };
        timestamp: string;
    }>;
}
