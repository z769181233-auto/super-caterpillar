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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ShotRenderReplicateAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotRenderReplicateAdapter = void 0;
const common_1 = require("@nestjs/common");
const replicate_1 = __importDefault(require("replicate"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const crypto_1 = require("crypto");
const promises_1 = require("stream/promises");
const path = __importStar(require("path"));
let ShotRenderReplicateAdapter = ShotRenderReplicateAdapter_1 = class ShotRenderReplicateAdapter {
    name = 'shot_render_replicate';
    logger = new common_1.Logger(ShotRenderReplicateAdapter_1.name);
    replicate;
    ASSETS_DIR = path.join(process.cwd(), 'apps/workers/.runtime/assets');
    constructor() {
        if (!fs.existsSync(this.ASSETS_DIR)) {
            fs.mkdirSync(this.ASSETS_DIR, { recursive: true });
        }
    }
    getReplicate() {
        if (this.replicate)
            return this.replicate;
        const token = process.env.REPLICATE_API_TOKEN;
        if (!token) {
            throw new Error('REPLICATE_API_TOKEN not configured in environment');
        }
        this.replicate = new replicate_1.default({ auth: token });
        return this.replicate;
    }
    supports(engineKey) {
        return (engineKey === 'shot_render' ||
            engineKey === 'default_shot_render' ||
            engineKey === 'real_shot_render');
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
            this.logger.log(`[ShotRenderReplicate] Generating image for prompt: ${prompt.substring(0, 50)}...`);
            const model = 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
            const [modelName, modelVersion] = model.split(':');
            const prediction = await this.getReplicate().predictions.create({
                version: modelVersion,
                input: {
                    prompt: prompt,
                    seed: seed,
                    width: 1024,
                    height: 1024,
                    num_outputs: 1,
                    scheduler: 'K_EULER',
                    num_inference_steps: 20,
                },
            });
            this.logger.log(`[ShotRenderReplicate] Prediction created: ${prediction.id}`);
            const predictionResult = await this.getReplicate().wait(prediction);
            if (predictionResult.status === 'failed') {
                throw new Error(`Replicate prediction failed: ${predictionResult.error}`);
            }
            const output = predictionResult.output;
            if (!output || output.length === 0) {
                throw new Error('Replicate returned empty output');
            }
            const imageUrl = output[0];
            this.logger.log(`[ShotRenderReplicate] Image generated: ${imageUrl}`);
            const filename = `shot_${traceId}_${seed}.png`;
            const localPath = path.join(this.ASSETS_DIR, filename);
            await this.downloadImage(imageUrl, localPath);
            const sha256 = await this.calculateSHA256(localPath);
            const stats = fs.statSync(localPath);
            const fileSize = stats.size;
            const latency = Date.now() - startTime;
            this.logger.log(`[ShotRenderReplicate] Success - File: ${localPath}, Size: ${fileSize} bytes, SHA256: ${sha256.substring(0, 16)}...`);
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
                        engine: 'replicate_sdxl',
                        seed: seed,
                        prompt: prompt,
                        replicateUrl: imageUrl,
                        fileSize: fileSize,
                        engine_run_id: prediction.id,
                        engine_provider: 'replicate',
                        engine_model: model,
                    },
                    audit_trail: {
                        message: 'Generated by Replicate SDXL',
                        engine: this.name,
                        timestamp: new Date().toISOString(),
                        prompt_hash: (0, crypto_1.createHash)('sha256').update(prompt).digest('hex'),
                        engineKey: 'shot_render',
                        traceId: traceId,
                        engineRunId: prediction.id,
                    },
                },
                metrics: {
                    latencyMs: latency,
                    gpuSeconds: 2.5,
                },
            };
        }
        catch (error) {
            this.logger.error(`[ShotRenderReplicate] Failed: ${error.message}`);
            return {
                status: 'FAILED',
                error: {
                    code: 'SHOT_RENDER_FAILED',
                    message: error.message,
                },
            };
        }
    }
    async downloadImage(url, localPath) {
        const response = await axios_1.default.get(url, { responseType: 'stream' });
        await (0, promises_1.pipeline)(response.data, fs.createWriteStream(localPath));
    }
    async calculateSHA256(filePath) {
        const hash = (0, crypto_1.createHash)('sha256');
        const stream = fs.createReadStream(filePath);
        return new Promise((resolve, reject) => {
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
};
exports.ShotRenderReplicateAdapter = ShotRenderReplicateAdapter;
exports.ShotRenderReplicateAdapter = ShotRenderReplicateAdapter = ShotRenderReplicateAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ShotRenderReplicateAdapter);
//# sourceMappingURL=shot-render.replicate.adapter.js.map