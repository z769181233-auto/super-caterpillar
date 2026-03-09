import { EngineAdminService, UpsertEngineInput, UpdateEngineInput, UpsertEngineVersionInput, UpdateEngineVersionInput } from './engine-admin.service';
export declare class EngineAdminController {
    private readonly service;
    constructor(service: EngineAdminService);
    list(): Promise<{
        success: boolean;
        data: any[];
    }>;
    listPublic(): Promise<{
        success: boolean;
        data: {
            engineKey: any;
            adapterName: any;
            adapterType: any;
            defaultVersion: any;
            versions: any;
            enabled: any;
        }[];
    }>;
    createOrReplace(body: UpsertEngineInput): Promise<{
        success: boolean;
        data: any;
    }>;
    update(key: string, body: UpdateEngineInput): Promise<{
        success: boolean;
        data: any;
    }>;
    remove(key: string): Promise<{
        success: boolean;
    }>;
    listVersions(key: string): Promise<{
        success: boolean;
        data: any[];
    }>;
    createOrUpdateVersion(key: string, body: UpsertEngineVersionInput): Promise<{
        success: boolean;
        data: any;
    }>;
    updateVersion(key: string, versionName: string, body: UpdateEngineVersionInput): Promise<{
        success: boolean;
        data: any;
    }>;
    deleteVersion(key: string, versionName: string): Promise<{
        success: boolean;
    }>;
    updateDefaultVersion(key: string, body: {
        defaultVersion: string | null;
    }): Promise<{
        success: boolean;
        data: any;
    }>;
}
