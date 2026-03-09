import { ModuleRef } from '@nestjs/core';
import { RegisterWorkerDto } from './dto/register-worker.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { Request } from 'express';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class WorkerController {
    private readonly moduleRef;
    private readonly auditLogService;
    constructor(moduleRef: ModuleRef, auditLogService: AuditLogService);
    private get workerService();
    register(registerDto: RegisterWorkerDto, user: {
        userId: string;
    }, request: Request): Promise<any>;
    heartbeat(workerId: string, heartbeatDto: HeartbeatDto, user: {
        userId: string;
    }, request: Request): Promise<any>;
    getOnlineWorkers(jobType?: string): Promise<{
        success: boolean;
        data: {
            id: any;
            workerId: any;
            status: any;
            capabilities: any;
            lastHeartbeat: any;
            tasksRunning: any;
        }[];
    }>;
    getNextJob(workerId: string, user: {
        userId: string;
    }, request: Request): Promise<any>;
}
