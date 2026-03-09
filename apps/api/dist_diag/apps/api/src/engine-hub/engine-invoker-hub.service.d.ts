import { OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EngineInvocationRequest, EngineInvocationResult } from '@scu/shared-types';
import { EngineRegistryHubService } from './engine-registry-hub.service';
import { HttpEngineAdapter } from '../engine/adapters/http-engine.adapter';
import { EngineRegistry } from '../engine/engine-registry.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CostLimitService } from '../cost/cost-limit.service';
export declare class EngineInvokerHubService implements OnModuleInit {
    private engineRegistry;
    private memoryRegistry;
    private readonly moduleRef;
    private httpEngineAdapter;
    private auditLogService;
    private costLimit;
    private readonly logger;
    constructor(engineRegistry: EngineRegistryHubService, memoryRegistry: EngineRegistry, moduleRef: ModuleRef, httpEngineAdapter: HttpEngineAdapter, auditLogService: AuditLogService, costLimit: CostLimitService);
    onModuleInit(): Promise<void>;
    private ensureDependencies;
    invoke<TInput, TOutput>(req: EngineInvocationRequest<TInput>): Promise<EngineInvocationResult<TOutput>>;
    private logInvocation;
    private inferJobTypeFromEngineKey;
}
