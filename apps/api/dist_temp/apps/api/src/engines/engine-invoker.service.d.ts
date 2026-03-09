import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
interface InvokeParams {
    adapter: EngineAdapter;
    input: EngineInvokeInput;
    engineKey: string;
}
export declare class EngineInvokerService {
    private readonly prisma;
    private readonly engineConfigStore;
    private readonly logger;
    private readonly circuitBreaker;
    private readonly FAILURE_THRESHOLD;
    private readonly RECOVERY_TIMEOUT_MS;
    constructor(prisma: PrismaService, engineConfigStore: EngineConfigStoreService);
    invoke({ adapter, input, engineKey }: InvokeParams): Promise<EngineInvokeResult>;
    private getCircuitState;
    private recordFailure;
    private resetCircuit;
}
export {};
