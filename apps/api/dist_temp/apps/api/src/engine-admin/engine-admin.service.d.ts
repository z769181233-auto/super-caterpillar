import { PrismaService } from '../prisma/prisma.service';
export interface UpsertEngineInput {
    engineKey: string;
    adapterName: string;
    adapterType: string;
    config: any;
    enabled?: boolean;
    version?: string | null;
}
export interface UpdateEngineInput {
    config?: any;
    enabled?: boolean;
    version?: string | null;
    adapterName?: string;
    adapterType?: string;
}
export interface UpsertEngineVersionInput {
    versionName: string;
    config: any;
    enabled?: boolean;
    rolloutWeight?: number | null;
}
export interface UpdateEngineVersionInput {
    config?: any;
    enabled?: boolean;
    rolloutWeight?: number | null;
}
export declare class EngineAdminService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(): Promise<any[]>;
    createOrReplace(input: UpsertEngineInput): Promise<any>;
    update(engineKey: string, input: UpdateEngineInput): Promise<any>;
    delete(engineKey: string): Promise<void>;
    listVersions(engineKey: string): Promise<any[]>;
    createOrUpdateVersion(engineKey: string, input: UpsertEngineVersionInput): Promise<any>;
    updateVersion(engineKey: string, versionName: string, input: UpdateEngineVersionInput): Promise<any>;
    deleteVersion(engineKey: string, versionName: string): Promise<void>;
    updateDefaultVersion(engineKey: string, defaultVersion: string | null): Promise<any>;
}
