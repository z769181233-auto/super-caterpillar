import { OnModuleInit } from '@nestjs/common';
import { EngineDescriptor } from './engine-descriptor.interface';
export declare class EngineRegistryHubService implements OnModuleInit {
    private readonly logger;
    private engines;
    onModuleInit(): void;
    private assertRegistryUnique;
    private assertRegistryComplete;
    find(engineKey: string, version?: string): EngineDescriptor | null;
    getAllEngines(): EngineDescriptor[];
}
