"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var HttpEngineAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpEngineAdapter = void 0;
const common_1 = require("@nestjs/common");
const engine_config_1 = require("../../config/engine.config");
const http_client_1 = require("../../common/http/http-client");
const crypto_1 = require("crypto");
let HttpEngineAdapter = HttpEngineAdapter_1 = class HttpEngineAdapter {
    engineConfigService;
    name = 'http';
    logger = new common_1.Logger(HttpEngineAdapter_1.name);
    constructor(engineConfigService) {
        this.engineConfigService = engineConfigService;
    }
    supports(engineKey) {
        return (engineKey === 'http' ||
            engineKey.startsWith('http_') ||
            engineKey === 'mock_http_engine' ||
            engineKey === 'ce06_novel_parsing' ||
            engineKey === 'ce03_visual_density' ||
            engineKey === 'ce04_visual_enrichment');
    }
    async invoke(input) {
        const startTime = Date.now();
        const { engineKey, jobType, payload, context } = input;
        try {
            const config = this.engineConfigService.getHttpEngineConfig(engineKey);
            const url = `${config.baseUrl}${config.path || '/invoke'}`;
            const requestBody = this.buildRequestBody(input);
            const headers = this.buildAuthHeaders(config, requestBody);
            const httpClient = new http_client_1.HttpClient({
                baseURL: config.baseUrl,
                timeout: config.timeoutMs,
                headers,
            });
            this.logRequestStart(engineKey, jobType, url, config, payload, context);
            const response = await httpClient.post(config.path || '/invoke', requestBody);
            const durationMs = Date.now() - startTime;
            return this.handleHttpResponse({ status: response.status, data: response.data, headers: response.headers }, engineKey, jobType, durationMs);
        }
        catch (error) {
            const durationMs = Date.now() - startTime;
            return this.handleHttpError(error, engineKey, jobType, durationMs);
        }
    }
    buildRequestBody(input) {
        const baseBody = {
            jobType: input.jobType,
            engineKey: input.engineKey,
            payload: input.payload ?? {},
            context: input.context ?? {},
        };
        switch (input.jobType) {
            case 'NOVEL_ANALYSIS_HTTP':
                return baseBody;
            case 'SHOT_RENDER_HTTP':
                return baseBody;
            default:
                return baseBody;
        }
    }
    buildAuthHeaders(config, requestBody) {
        const headers = {};
        switch (config.authMode) {
            case 'bearer':
                if (!config.apiKey || config.apiKey.trim() === '') {
                    throw new Error(`HTTP_ENGINE_API_KEY is required when authMode is 'bearer'`);
                }
                headers['Authorization'] = `Bearer ${config.apiKey}`;
                break;
            case 'apiKey':
                if (!config.apiKey || config.apiKey.trim() === '') {
                    throw new Error(`HTTP_ENGINE_API_KEY is required when authMode is 'apiKey'`);
                }
                headers[config.apiKeyHeader || 'X-API-Key'] = config.apiKey;
                break;
            case 'hmac':
                {
                    if (!config.hmac) {
                        throw new Error(`HTTP_ENGINE_HMAC_SECRET is required when authMode is 'hmac'`);
                    }
                    const hmacHeaders = this.buildHmacHeaders(config.hmac, requestBody);
                    Object.assign(headers, hmacHeaders);
                }
                break;
            case 'none':
                break;
            default:
                throw new Error(`Unsupported authMode: ${config.authMode}`);
        }
        return headers;
    }
    buildHmacHeaders(hmacConfig, requestBody) {
        const timestamp = Date.now().toString();
        const nonce = (0, crypto_1.randomBytes)(16).toString('hex');
        const bodyString = JSON.stringify(requestBody);
        const bodyHash = this.computeBodyHash(bodyString);
        const message = `POST\n${'/invoke'}\n${bodyHash}\n${nonce}\n${timestamp}`;
        const signature = this.computeHmacSignature(hmacConfig.secret, message);
        return {
            [hmacConfig.header || 'X-Signature']: signature,
            'X-Timestamp': timestamp,
            'X-Nonce': nonce,
            'X-API-Key': hmacConfig.keyId,
        };
    }
    computeBodyHash(body) {
        return (0, crypto_1.createHash)('sha256').update(body, 'utf8').digest('hex');
    }
    computeHmacSignature(secret, message) {
        const hmac = (0, crypto_1.createHmac)('sha256', secret);
        hmac.update(message);
        return hmac.digest('hex');
    }
    logRequestStart(engineKey, jobType, url, config, payload, context) {
        const logData = {
            event: 'HTTP_ENGINE_INVOKE_START',
            engineKey,
            jobType,
            url,
            payloadSize: JSON.stringify(payload).length,
            contextKeys: Object.keys(context),
            authMode: config.authMode,
        };
        if (config.apiKey) {
            const apiKey = config.apiKey;
            if (apiKey.length >= 8) {
                logData.hasApiKey = true;
                logData.apiKeyPrefix = apiKey.substring(0, 4);
                logData.apiKeySuffix = apiKey.substring(apiKey.length - 4);
                logData.apiKeyLength = apiKey.length;
            }
            else {
                logData.hasApiKey = true;
                logData.apiKeyLength = apiKey.length;
            }
        }
        else {
            logData.hasApiKey = false;
        }
        this.logger.log(JSON.stringify(logData));
    }
    handleHttpResponse(response, engineKey, jobType, durationMs) {
        const responseData = response.data;
        if (response.status >= 200 && response.status < 300) {
            if (responseData.success === true || responseData.status === 'SUCCESS') {
                const output = this.parseResponseData(responseData, jobType);
                const metrics = this.parseMetrics(responseData.metrics, durationMs);
                this.logger.log(JSON.stringify({
                    event: 'HTTP_ENGINE_INVOKE_SUCCESS',
                    engineKey,
                    jobType,
                    status: 'SUCCESS',
                    durationMs,
                    httpStatusCode: response.status,
                    outputSize: output ? JSON.stringify(output).length : 0,
                }));
                return {
                    status: 'SUCCESS',
                    output,
                    metrics,
                };
            }
            const errorCode = responseData.error?.code || 'BUSINESS_ERROR';
            const errorMessage = responseData.error?.message || 'Business logic failed';
            this.logger.warn(JSON.stringify({
                event: 'HTTP_ENGINE_INVOKE_BUSINESS_ERROR',
                engineKey,
                jobType,
                status: 'FAILED',
                durationMs,
                httpStatusCode: response.status,
                errorCode,
                errorMessage,
            }));
            return {
                status: 'FAILED',
                error: {
                    message: errorMessage,
                    code: errorCode,
                    details: {
                        ...responseData.error?.details,
                        errorType: 'BUSINESS_ERROR',
                    },
                },
                metrics: {
                    durationMs,
                },
            };
        }
        if (response.status === 429) {
            const retryAfter = response.headers['retry-after'] || response.headers['Retry-After'];
            this.logger.warn(JSON.stringify({
                event: 'HTTP_ENGINE_INVOKE_RATE_LIMIT',
                engineKey,
                jobType,
                status: 'RETRYABLE',
                httpStatusCode: 429,
                retryAfter: retryAfter || undefined,
                durationMs,
                timestamp: new Date().toISOString(),
            }));
            return {
                status: 'RETRYABLE',
                error: {
                    message: `HTTP 429 Too Many Requests${retryAfter ? `, Retry-After: ${retryAfter}` : ''}`,
                    code: 'HTTP_RATE_LIMIT',
                    details: { retryAfter, errorType: 'HTTP_429' },
                },
                metrics: {
                    durationMs,
                },
            };
        }
        if (response.status >= 500) {
            this.logger.warn(JSON.stringify({
                event: 'HTTP_ENGINE_INVOKE_HTTP_ERROR',
                engineKey,
                jobType,
                status: 'RETRYABLE',
                durationMs,
                httpStatusCode: response.status,
                errorCode: 'HTTP_SERVER_ERROR',
            }));
            return {
                status: 'RETRYABLE',
                error: {
                    message: `HTTP ${response.status} Server Error`,
                    code: 'HTTP_SERVER_ERROR',
                    details: { errorType: 'HTTP_5XX' },
                },
                metrics: {
                    durationMs,
                },
            };
        }
        this.logger.error(JSON.stringify({
            event: 'HTTP_ENGINE_INVOKE_HTTP_ERROR',
            engineKey,
            jobType,
            status: 'FAILED',
            durationMs,
            httpStatusCode: response.status,
            errorCode: 'HTTP_CLIENT_ERROR',
        }));
        return {
            status: 'FAILED',
            error: {
                message: `HTTP ${response.status} Client Error`,
                code: 'HTTP_CLIENT_ERROR',
                details: { errorType: 'HTTP_4XX' },
            },
            metrics: {
                durationMs,
            },
        };
    }
    parseResponseData(responseData, jobType) {
        if (!responseData)
            return {};
        const data = responseData.data ?? {};
        switch (jobType) {
            case 'NOVEL_ANALYSIS_HTTP':
                return data;
            case 'SHOT_RENDER_HTTP':
                return data;
            default:
                return data;
        }
    }
    parseMetrics(rawMetrics, durationMs) {
        if (!rawMetrics && durationMs === undefined)
            return undefined;
        return {
            durationMs: durationMs ?? rawMetrics?.durationMs,
            tokensUsed: rawMetrics?.tokensUsed ?? rawMetrics?.tokens,
            cost: rawMetrics?.cost ?? rawMetrics?.costUsd,
            ...rawMetrics,
        };
    }
    handleHttpError(error, engineKey, jobType, durationMs) {
        if (error.type === 'NETWORK_ERROR') {
            const errorCode = this.mapNetworkErrorCode(error.code);
            this.logger.warn(JSON.stringify({
                event: 'HTTP_ENGINE_INVOKE_NETWORK_ERROR',
                engineKey,
                jobType,
                status: 'RETRYABLE',
                durationMs,
                errorCode,
                errorMessage: error.message,
            }));
            return {
                status: 'RETRYABLE',
                error: {
                    message: error.message || 'Network or timeout error',
                    code: errorCode,
                    details: { errorType: 'NETWORK_ERROR' },
                },
                metrics: {
                    durationMs,
                },
            };
        }
        if (error.type === 'HTTP_ERROR') {
            if (error.status === 429) {
                this.logger.warn(JSON.stringify({
                    event: 'HTTP_ENGINE_INVOKE_RATE_LIMIT',
                    engineKey,
                    jobType,
                    status: 'RETRYABLE',
                    httpStatusCode: 429,
                    durationMs,
                    timestamp: new Date().toISOString(),
                }));
                return {
                    status: 'RETRYABLE',
                    error: {
                        message: `HTTP 429 Too Many Requests`,
                        code: 'HTTP_RATE_LIMIT',
                        details: { errorType: 'HTTP_429' },
                    },
                    metrics: {
                        durationMs,
                    },
                };
            }
            if (error.status >= 500) {
                this.logger.warn(JSON.stringify({
                    event: 'HTTP_ENGINE_INVOKE_HTTP_ERROR',
                    engineKey,
                    jobType,
                    status: 'RETRYABLE',
                    durationMs,
                    httpStatusCode: error.status,
                    errorCode: 'HTTP_SERVER_ERROR',
                }));
                return {
                    status: 'RETRYABLE',
                    error: {
                        message: error.message || `HTTP ${error.status} Server Error`,
                        code: 'HTTP_SERVER_ERROR',
                        details: { errorType: 'HTTP_5XX' },
                    },
                    metrics: {
                        durationMs,
                    },
                };
            }
            this.logger.error(JSON.stringify({
                event: 'HTTP_ENGINE_INVOKE_HTTP_ERROR',
                engineKey,
                jobType,
                status: 'FAILED',
                durationMs,
                httpStatusCode: error.status,
                errorCode: 'HTTP_CLIENT_ERROR',
            }));
            return {
                status: 'FAILED',
                error: {
                    message: error.message || `HTTP ${error.status} Client Error`,
                    code: 'HTTP_CLIENT_ERROR',
                    details: { errorType: 'HTTP_4XX' },
                },
                metrics: {
                    durationMs,
                },
            };
        }
        this.logger.error(JSON.stringify({
            event: 'HTTP_ENGINE_INVOKE_FAILED',
            engineKey,
            jobType,
            status: 'FAILED',
            durationMs,
            errorCode: 'UNKNOWN_ERROR',
            errorMessage: error.message || 'Unknown error',
        }));
        return {
            status: 'FAILED',
            error: {
                message: error.message || 'HTTP request failed',
                code: 'UNKNOWN_ERROR',
                details: { errorType: 'UNKNOWN_ERROR' },
            },
            metrics: {
                durationMs,
            },
        };
    }
    mapNetworkErrorCode(code) {
        const retryableCodes = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENETUNREACH',
            'ECONNREFUSED',
            'EHOSTUNREACH',
            'EAI_AGAIN',
        ];
        if (retryableCodes.includes(code)) {
            return 'HTTP_TEMPORARY_ERROR';
        }
        return 'HTTP_TEMPORARY_ERROR';
    }
};
exports.HttpEngineAdapter = HttpEngineAdapter;
exports.HttpEngineAdapter = HttpEngineAdapter = HttpEngineAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [engine_config_1.EngineConfigService])
], HttpEngineAdapter);
//# sourceMappingURL=http-engine.adapter.js.map