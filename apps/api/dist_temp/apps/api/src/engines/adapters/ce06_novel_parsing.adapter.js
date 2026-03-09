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
var CE06LocalAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CE06LocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const engines_ce06_1 = require("@scu/engines-ce06");
const local_storage_service_1 = require("../../storage/local-storage.service");
let CE06LocalAdapter = CE06LocalAdapter_1 = class CE06LocalAdapter {
    localStorage;
    name = 'ce06_novel_parsing';
    logger = new common_1.Logger(CE06LocalAdapter_1.name);
    constructor(localStorage) {
        this.localStorage = localStorage;
    }
    supports(engineKey) {
        return engineKey === 'ce06_novel_parsing';
    }
    async invoke(input) {
        this.logger.log(`[CE06_ADAPTER] Invoking real engine for traceId=${input.context?.traceId}`);
        try {
            let payload = input.payload;
            if (payload.novelRef && payload.novelRef.storageKey) {
                this.logger.log(`[CE06_ADAPTER] Resolving novelRef: ${payload.novelRef.storageKey}`);
                const rawText = await this.localStorage.readString(payload.novelRef.storageKey);
                payload = {
                    ...payload,
                    structured_text: rawText,
                };
            }
            let model = payload.model || 'gemini-1.5-flash';
            if (model === 'gemini-1.5-flash') {
                model = 'gemini-flash-latest';
            }
            const output = await (0, engines_ce06_1.ce06Selector)({
                ...payload,
                model,
                traceId: input.context?.traceId,
                projectId: input.context?.projectId,
            });
            if (!output) {
                throw new Error('CE06 Engine returned null output');
            }
            return {
                status: 'SUCCESS',
                output,
                metrics: {
                    tokens: output.billing_usage ? output.billing_usage.totalTokens : 0,
                    latencyMs: output.latency_ms || 0,
                },
            };
        }
        catch (error) {
            this.logger.error(`[CE06_ADAPTER] Failed: ${error.message}`);
            return {
                status: 'FAILED',
                error: {
                    code: 'ADAPTER_EXECUTION_FAILED',
                    message: error.message,
                },
            };
        }
    }
};
exports.CE06LocalAdapter = CE06LocalAdapter;
exports.CE06LocalAdapter = CE06LocalAdapter = CE06LocalAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [local_storage_service_1.LocalStorageService])
], CE06LocalAdapter);
//# sourceMappingURL=ce06_novel_parsing.adapter.js.map