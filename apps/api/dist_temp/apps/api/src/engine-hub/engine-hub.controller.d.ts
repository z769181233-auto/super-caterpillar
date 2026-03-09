import { EngineInvocationRequest } from '@scu/shared-types';
import { EngineInvokerHubService } from './engine-invoker-hub.service';
import { ModuleRef } from '@nestjs/core';
export declare class EngineHubController {
    private readonly moduleRef;
    private engineInvoker;
    private readonly logger;
    constructor(moduleRef: ModuleRef, engineInvoker: EngineInvokerHubService);
    invoke(req: EngineInvocationRequest<unknown>): Promise<{
        success: boolean;
        data: import("@scu/shared-types").EngineInvocationResult<unknown>;
    }>;
}
