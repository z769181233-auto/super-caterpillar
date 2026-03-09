import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import { EngineConfigService } from '../../config/engine.config';
export declare class HttpEngineAdapter implements EngineAdapter {
    private readonly engineConfigService;
    readonly name = "http";
    private readonly logger;
    constructor(engineConfigService: EngineConfigService);
    supports(engineKey: string): boolean;
    invoke(input: EngineInvokeInput): Promise<EngineInvokeResult>;
    private buildRequestBody;
    private buildAuthHeaders;
    private buildHmacHeaders;
    private computeBodyHash;
    private computeHmacSignature;
    private logRequestStart;
    private handleHttpResponse;
    private parseResponseData;
    private parseMetrics;
    private handleHttpError;
    private mapNetworkErrorCode;
}
