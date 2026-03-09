"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ShotRenderComfyuiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotRenderComfyuiAdapter = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const crypto_1 = require("crypto");
const path = __importStar(require("path"));
const engines_shot_render_1 = require("@scu/engines-shot-render");
let ShotRenderComfyuiAdapter = ShotRenderComfyuiAdapter_1 = class ShotRenderComfyuiAdapter {
    name = 'shot_render_comfyui';
    logger = new common_1.Logger(ShotRenderComfyuiAdapter_1.name);
    ASSETS_DIR = path.join(process.cwd(), 'apps/workers/.runtime/assets');
    constructor() {
        if (!fs.existsSync(this.ASSETS_DIR)) {
            fs.mkdirSync(this.ASSETS_DIR, { recursive: true });
        }
    }
    supports(engineKey) {
        return engineKey === 'shot_render_comfyui';
    }
    async invoke(input) {
        const prompt = input.payload.enrichedPrompt || input.payload.prompt;
        const seed = input.payload.seed || Math.floor(Math.random() * 1000000);
        const traceId = input.context?.traceId || input.context?.jobId || `trace_${Date.now()}`;
        if (!prompt) {
            throw new Error('Missing enrichedPrompt or prompt in payload');
        }
        const startTime = Date.now();
        try {
            this.logger.log(`[ShotRenderComfyui] Generating image for prompt: ${prompt.substring(0, 50)}...`);
            const result = await engines_shot_render_1.comfyuiProvider.render(prompt, {
                width: 1024,
                height: 1024,
                seed,
                checkpoint: input.payload.checkpoint || 'sdxl_guoman_v4.safetensors',
                loras: input.payload.loras || [],
                negativePrompt: input.payload.negative_prompt,
            });
            const filename = `shot_${traceId}_${seed}.png`;
            const localPath = path.join(this.ASSETS_DIR, filename);
            fs.writeFileSync(localPath, result.bytes);
            const sha256 = (0, crypto_1.createHash)('sha256').update(result.bytes).digest('hex');
            const fileSize = result.bytes.length;
            const latency = Date.now() - startTime;
            this.logger.log(`[ShotRenderComfyui] Success - File: ${localPath}, Size: ${fileSize} bytes, SHA256: ${sha256.substring(0, 16)}...`);
            return {
                status: 'SUCCESS',
                output: {
                    asset: {
                        uri: localPath,
                        sha256: sha256,
                    },
                    render_meta: {
                        width: 1024,
                        height: 1024,
                        mocked: false,
                        engine: 'comfyui_sdxl',
                        seed: seed,
                        prompt: prompt,
                        fileSize: fileSize,
                    },
                    audit_trail: {
                        message: 'Generated by ComfyUI SDXL',
                        engine: this.name,
                        timestamp: new Date().toISOString(),
                        prompt_hash: (0, crypto_1.createHash)('sha256').update(prompt).digest('hex'),
                        engineKey: 'shot_render',
                        traceId: traceId,
                    },
                },
                metrics: {
                    latencyMs: latency,
                    gpuSeconds: result.gpuSeconds,
                },
            };
        }
        catch (error) {
            this.logger.error(`[ShotRenderComfyui] Failed: ${error.message}`);
            return {
                status: 'FAILED',
                error: {
                    code: 'SHOT_RENDER_FAILED',
                    message: error.message,
                },
            };
        }
    }
};
exports.ShotRenderComfyuiAdapter = ShotRenderComfyuiAdapter;
exports.ShotRenderComfyuiAdapter = ShotRenderComfyuiAdapter = ShotRenderComfyuiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ShotRenderComfyuiAdapter);
//# sourceMappingURL=shot-render.comfyui.adapter.js.map