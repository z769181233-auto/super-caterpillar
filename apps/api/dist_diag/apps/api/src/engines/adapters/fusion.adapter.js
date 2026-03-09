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
var FusionAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FusionAdapter = void 0;
const common_1 = require("@nestjs/common");
const os_exec_1 = require("../../../../../packages/shared/os_exec");
const config_1 = require("@scu/config");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const perf_hooks_1 = require("perf_hooks");
let FusionAdapter = FusionAdapter_1 = class FusionAdapter {
    name = 'fusion';
    logger = new common_1.Logger(FusionAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'fusion' || engineKey === 'ce11_fusion_real';
    }
    async invoke(input) {
        const t0 = perf_hooks_1.performance.now();
        const { novelText, referenceImageUrl, controlPoseUrl, loraId, projectId, shotId } = input.payload;
        this.logger.log(`[FusionAdapter] Starting Fusion Generation for Shot ${shotId}`);
        try {
            const repoRoot = config_1.config.repoRoot;
            const scriptPath = path.join(repoRoot, 'apps/fusion-engine/scripts/e2e_inference.py');
            const outputPath = path.join(config_1.config.storageRoot, `outputs/fusion_${shotId}.mp4`);
            if (!fs.existsSync(path.dirname(outputPath))) {
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            }
            const args = ['--text', novelText || 'Default scene description', '--output', outputPath];
            if (referenceImageUrl)
                args.push('--ref', referenceImageUrl);
            if (loraId)
                args.push('--lora', loraId);
            this.logger.log(`[FusionAdapter] Executing: python3 ${scriptPath} ...`);
            const res = await (0, os_exec_1.execAsync)('python3', [scriptPath, ...args], {
                env: {
                    ...process.env,
                    PYTHONPATH: `${process.env.PYTHONPATH}:${path.join(repoRoot, 'apps/fusion-engine')}`,
                    WANDB_MODE: 'disabled',
                    PYTHONDONTWRITEBYTECODE: '1',
                },
            });
            if (res.code !== 0) {
                throw new Error(`FUSION_EXEC_FAIL: ${res.stderr}`);
            }
            const obfuscateScript = path.join(repoRoot, 'apps/fusion-engine/scripts/obfuscate_video.py');
            const finalOutputPath = outputPath.replace('.mp4', '_secured.mp4');
            this.logger.log(`[FusionAdapter] Obfuscating: ${outputPath} -> ${finalOutputPath}`);
            const obfRes = await (0, os_exec_1.execAsync)('python3', [
                obfuscateScript,
                '--input',
                outputPath,
                '--output',
                finalOutputPath,
            ]);
            if (obfRes.code !== 0) {
                throw new Error(`FUSION_OBFUSCATE_FAIL: ${obfRes.stderr}`);
            }
            if (!fs.existsSync(finalOutputPath)) {
                throw new Error(`FUSION_OBFUSCATE_FILE_MISSING: ${finalOutputPath} was not created`);
            }
            const sha256 = await this.calculateSha256(finalOutputPath);
            return {
                status: 'SUCCESS',
                output: {
                    localPath: finalOutputPath,
                    asset: {
                        uri: `outputs/fusion_${shotId}_secured.mp4`,
                        sha256,
                    },
                    storageKey: `outputs/fusion_${shotId}_secured.mp4`,
                    sha256,
                    render_meta: {
                        engine: 'fusion_v1_dit',
                        status: 'SECURED',
                        obfuscated: true,
                        provider: 'local_cluster',
                    },
                },
                metrics: {
                    durationMs: Math.round(perf_hooks_1.performance.now() - t0),
                },
            };
        }
        catch (error) {
            this.logger.error(`[FusionAdapter_ERROR] ${error.message}`);
            return {
                status: 'FAILED',
                error: { code: 'FUSION_ADAPTER_FAIL', message: error.message },
            };
        }
    }
    async calculateSha256(filePath) {
        const { createHash } = await Promise.resolve().then(() => __importStar(require('crypto')));
        const hash = createHash('sha256');
        const buffer = fs.readFileSync(filePath);
        return hash.update(buffer).digest('hex');
    }
};
exports.FusionAdapter = FusionAdapter;
exports.FusionAdapter = FusionAdapter = FusionAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], FusionAdapter);
//# sourceMappingURL=fusion.adapter.js.map