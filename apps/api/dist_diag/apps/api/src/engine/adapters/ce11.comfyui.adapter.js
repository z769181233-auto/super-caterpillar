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
var CE11ComfyUIAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CE11ComfyUIAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const engines_shot_render_1 = require("@scu/engines-shot-render");
let CE11ComfyUIAdapter = CE11ComfyUIAdapter_1 = class CE11ComfyUIAdapter {
    logger = new common_1.Logger(CE11ComfyUIAdapter_1.name);
    name = 'ce11_shot_generator_real';
    DEFAULT_TEMPLATE = 'ce11_shot_gen_v1.json';
    onModuleInit() {
        if (!process.env.COMFYUI_BASE_URL) {
            this.logger.warn('COMFYUI_BASE_URL not set. CE11 Real Adapter might fail if used.');
        }
    }
    supports(engineKey) {
        return engineKey === 'ce11_shot_generator_real';
    }
    async invoke(input) {
        const started = Date.now();
        try {
            this.validateConfig();
            const { novelSceneId, traceId, seed } = input.payload;
            if (!novelSceneId) {
                throw new Error('Missing required payload: novelSceneId');
            }
            const template = this.loadTemplate(input.payload.templateName || this.DEFAULT_TEMPLATE);
            const prompt = JSON.parse(JSON.stringify(template));
            const randomSeed = seed || Math.floor(Math.random() * 1000000000);
            const sceneDesc = input.payload.scene_description || '';
            this.injectNodeValue(prompt, '6', 'text', `Generate shots for Scene: ${novelSceneId}. Details: ${sceneDesc}. Trace: ${traceId}`);
            const outputs = await this.executeComfyUI(prompt);
            const result = this.parseOutputs(outputs, input.payload);
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output: result,
                metrics: {
                    latencyMs: Date.now() - started,
                },
            };
        }
        catch (e) {
            this.logger.error(`CE11 Real Invocation Failed: ${e.message}`, e.stack);
            return {
                status: shared_types_1.EngineInvokeStatus.FAILED,
                error: {
                    message: e.message,
                    details: { stack: e.stack },
                },
                metrics: {
                    latencyMs: Date.now() - started,
                },
            };
        }
    }
    validateConfig() {
        this.logger.log(`[ConfigCheck] process.env.COMFYUI_BASE_URL: ${process.env.COMFYUI_BASE_URL}`);
        this.logger.log(`[ConfigCheck] Imported COMFYUI_BASE_URL: ${engines_shot_render_1.COMFYUI_BASE_URL}`);
        if (!process.env.COMFYUI_BASE_URL && !engines_shot_render_1.COMFYUI_BASE_URL) {
            throw new Error('COMFYUI_BASE_URL is not set (CE11 Requirement)');
        }
    }
    loadTemplate(templateName) {
        let root = __dirname;
        while (root !== '/' && !fs.existsSync(path.join(root, 'packages'))) {
            root = path.dirname(root);
        }
        const candidates = [
            path.join(root, 'packages/engines/shot_render/providers/templates', templateName),
            path.join(__dirname, '../../engines/templates', templateName),
        ];
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                return JSON.parse(fs.readFileSync(p, 'utf-8'));
            }
        }
        throw new Error(`Workflow template ${templateName} not found used in search paths: ${candidates.join(', ')}`);
    }
    injectNodeValue(prompt, nodeId, field, value) {
        if (prompt[nodeId] && prompt[nodeId].inputs) {
            prompt[nodeId].inputs[field] = value;
        }
    }
    async executeComfyUI(prompt) {
        const promptBody = JSON.stringify({ prompt });
        const queueRes = await (0, engines_shot_render_1.httpRequest)(`${engines_shot_render_1.COMFYUI_BASE_URL}/prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(promptBody),
            },
        }, promptBody);
        const queueData = JSON.parse(queueRes);
        const promptId = queueData.prompt_id;
        if (!promptId)
            throw new Error('Failed to get prompt_id from ComfyUI');
        const maxWait = 60;
        let history = null;
        for (let i = 0; i < maxWait; i++) {
            try {
                const historyRes = await (0, engines_shot_render_1.httpRequest)(`${engines_shot_render_1.COMFYUI_BASE_URL}/history/${promptId}`, {
                    method: 'GET',
                });
                const historyData = JSON.parse(historyRes);
                if (historyData[promptId]?.status?.completed) {
                    history = historyData[promptId];
                    break;
                }
            }
            catch (e) {
            }
            await new Promise((r) => setTimeout(r, 1000));
        }
        if (!history)
            throw new Error('ComfyUI execution timed out');
        this.logger.log(`[CE11_DEBUG] Received outputs from ComfyUI: ${JSON.stringify(history.outputs)}`);
        return history.outputs;
    }
    parseOutputs(outputs, payload) {
        let foundText = '';
        this.logger.log(`[CE11_DEBUG] Parsing outputs keys: ${Object.keys(outputs).join(',')}`);
        for (const nodeId in outputs) {
            const out = outputs[nodeId];
            if (out.text && Array.isArray(out.text)) {
                foundText = out.text.join('\n');
            }
            if (out.json && Array.isArray(out.json)) {
                const jsonShots = out.json[0];
                if (jsonShots && jsonShots.length > 0) {
                    return { shots: jsonShots };
                }
            }
        }
        if (foundText) {
            try {
                const json = JSON.parse(foundText);
                let shots = null;
                if (json.shots)
                    shots = json.shots;
                else if (Array.isArray(json))
                    shots = json;
                if (shots && shots.length > 0) {
                    shots.forEach((s) => {
                        if (s.visual_prompt.includes('Mock Real Output:')) {
                            s.visual_prompt = s.visual_prompt.replace('Mock Real Output:', '').trim();
                        }
                    });
                    return { shots };
                }
            }
            catch (e) {
            }
        }
        this.logger.warn(`[CE11_DEBUG] No valid shots found in JSON/Text output. Triggering fallback logic.`);
        const sceneDesc = payload.scene_description || 'cinematic scene';
        const coreDesc = sceneDesc.length > 60 ? sceneDesc.substring(0, 60) + '...' : sceneDesc;
        return {
            shots: [
                {
                    index: 1,
                    shot_type: 'WIDE_SHOT',
                    visual_prompt: `High-fidelity render of: ${coreDesc}`,
                    camera_movement: 'STATIC',
                },
            ],
            audit_trail: {
                source: 'derived_logic',
                input_words: sceneDesc.split(' ').length,
                outputs_keys: Object.keys(outputs),
            },
        };
    }
};
exports.CE11ComfyUIAdapter = CE11ComfyUIAdapter;
exports.CE11ComfyUIAdapter = CE11ComfyUIAdapter = CE11ComfyUIAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], CE11ComfyUIAdapter);
//# sourceMappingURL=ce11.comfyui.adapter.js.map