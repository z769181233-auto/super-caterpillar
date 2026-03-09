"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClient = void 0;
const axios_1 = __importDefault(require("axios"));
class HttpClient {
    client;
    constructor(config) {
        this.client = axios_1.default.create({
            baseURL: config.baseURL,
            timeout: config.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
        });
    }
    async post(path, data, config) {
        try {
            const response = await this.client.post(path, data, config);
            return {
                status: response.status,
                data: response.data,
                headers: response.headers,
            };
        }
        catch (error) {
            console.error('[HttpClient] Raw Error:', error);
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                if (axiosError.response) {
                    throw {
                        type: 'HTTP_ERROR',
                        status: axiosError.response.status,
                        statusText: axiosError.response.statusText,
                        data: axiosError.response.data,
                        message: `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
                    };
                }
                else if (axiosError.request) {
                    const code = axiosError.code || 'UNKNOWN';
                    throw {
                        type: 'NETWORK_ERROR',
                        code,
                        message: axiosError.message || 'Network request failed',
                        originalError: axiosError,
                    };
                }
            }
            throw {
                type: 'UNKNOWN_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
                originalError: error,
            };
        }
    }
}
exports.HttpClient = HttpClient;
//# sourceMappingURL=http-client.js.map