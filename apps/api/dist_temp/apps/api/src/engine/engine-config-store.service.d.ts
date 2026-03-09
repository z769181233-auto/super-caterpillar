import { PrismaService } from '../prisma/prisma.service';
declare const enginesJson: any;
type EngineJsonConfig = (typeof enginesJson)['engines'][number];
export declare class EngineConfigStoreService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByEngineKey(engineKey: string): Promise<any | null>;
    findVersion(engineKey: string, versionName: string): Promise<any | null>;
    listVersions(engineKey: string): Promise<any[]>;
    listAllEngines(): Promise<any[]>;
    mergeConfig(dbEngine: any | null, jsonConfig?: EngineJsonConfig): any;
    private deepMerge;
    resolveEngineConfig(engineKey: string, requestedVersion?: string): Promise<any>;
    getJsonConfig(engineKey: string): EngineJsonConfig | undefined;
}
export {};
