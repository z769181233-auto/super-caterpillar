import { WorkerService } from '../worker/worker.service';
import { RegisterWorkerDto } from '../worker/dto/register-worker.dto';
import { HeartbeatDto } from '../worker/dto/heartbeat.dto';
import { Request } from 'express';
import { AuditLogService } from '../audit-log/audit-log.service';
export declare class WorkerAliasController {
    private readonly workerService;
    private readonly auditLogService;
    constructor(workerService: WorkerService, auditLogService: AuditLogService);
    register(registerDto: RegisterWorkerDto, user: {
        userId: string;
    }, request: Request): Promise<any>;
    heartbeat(workerId: string, heartbeatDto: HeartbeatDto, user: {
        userId: string;
    }, request: Request): Promise<any>;
    getNextJob(workerId: string, user: {
        userId: string;
    }, request: Request): Promise<any>;
}
