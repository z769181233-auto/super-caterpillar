import { EngineConfigStoreService } from './engine-config-store.service';
import { EngineAdminService } from '../engine-admin/engine-admin.service';
export declare class EngineController {
    private readonly engineConfigStore;
    private readonly engineAdminService;
    constructor(engineConfigStore: EngineConfigStoreService, engineAdminService: EngineAdminService);
    list(): Promise<{
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
}
