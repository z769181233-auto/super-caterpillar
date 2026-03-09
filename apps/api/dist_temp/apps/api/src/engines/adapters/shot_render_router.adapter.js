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
var ShotRenderRouterAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShotRenderRouterAdapter = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const shot_render_replicate_adapter_1 = require("./shot-render.replicate.adapter");
const shot_render_local_adapter_1 = require("./shot-render.local.adapter");
const shot_render_comfyui_adapter_1 = require("./shot-render.comfyui.adapter");
const shot_render_mps_adapter_1 = require("./shot-render.mps.adapter");
const mock_engine_adapter_1 = require("../../engine/adapters/mock-engine.adapter");
const character_service_1 = require("../../character/character.service");
const fusion_adapter_1 = require("./fusion.adapter");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const vg08_advanced_lighting_adapter_1 = require("./vg08_advanced_lighting.adapter");
const ce13_pacing_analyzer_adapter_1 = require("./ce13_pacing_analyzer.adapter");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
let ShotRenderRouterAdapter = ShotRenderRouterAdapter_1 = class ShotRenderRouterAdapter {
    moduleRef;
    prisma;
    replicateAdapter;
    comfyuiAdapter;
    localAdapter;
    mpsAdapter;
    fusionAdapter;
    lightingAdapter;
    pacingAdapter;
    name = 'shot_render_router';
    logger = new common_1.Logger(ShotRenderRouterAdapter_1.name);
    adapters;
    constructor(moduleRef, prisma, replicateAdapter, comfyuiAdapter, localAdapter, mpsAdapter, fusionAdapter, lightingAdapter, pacingAdapter) {
        this.moduleRef = moduleRef;
        this.prisma = prisma;
        this.replicateAdapter = replicateAdapter;
        this.comfyuiAdapter = comfyuiAdapter;
        this.localAdapter = localAdapter;
        this.mpsAdapter = mpsAdapter;
        this.fusionAdapter = fusionAdapter;
        this.lightingAdapter = lightingAdapter;
        this.pacingAdapter = pacingAdapter;
        this.adapters = {
            replicate: this.replicateAdapter,
            comfyui: this.comfyuiAdapter,
            local: this.localAdapter,
            local_mps: this.mpsAdapter,
            fusion: this.fusionAdapter,
        };
    }
    mockAdapter;
    characterService;
    async onModuleInit() {
        this.ensureDependencies();
    }
    ensureDependencies() {
        if (!this.mockAdapter) {
            try {
                this.mockAdapter = this.moduleRef.get(mock_engine_adapter_1.MockEngineAdapter, { strict: false });
            }
            catch (e) {
            }
        }
        if (!this.characterService) {
            try {
                this.characterService = this.moduleRef.get(character_service_1.CharacterService, { strict: false });
            }
            catch (e) {
            }
        }
    }
    supports(engineKey) {
        return (engineKey === 'shot_render' ||
            engineKey === 'default_shot_render' ||
            engineKey === 'real_shot_render' ||
            engineKey === 'fusion');
    }
    async invoke(input) {
        this.ensureDependencies();
        await this.mountCharacterLora(input);
        const { provider, reason } = this.selectProvider();
        const adapter = this.getAdapter(provider);
        this.logger.log(`[ShotRenderRouter] [DEBUG] process.env.SHOT_RENDER_PROVIDER=${process.env.SHOT_RENDER_PROVIDER}`);
        this.logger.log(`[ShotRenderRouter] Selected provider: ${provider} (reason: ${reason})`);
        const aestheticResult = await this.coordinateStellarAesthetics(input);
        const GUOMAN_STYLE = aestheticResult.enrichedStyle;
        const NEGATIVE = '2D, illustration, drawing, sketch, painting, flat color, ink, watercolor, lines, blurry, grainy, scenery, background artifacts, distorted anatomy, plastic skin, low poly, cartoonish, low resolution';
        let finalPrompt = input.payload.prompt || '';
        const characterId = input.payload.characterId;
        if (characterId && this.characterService) {
            const character = await this.characterService.findOne(characterId);
            if (character) {
                const charDna = character.attributes?.visual_dna || character.description;
                if (charDna) {
                    this.logger.log(`[ShotRenderRouter] Injecting DNA for character ${character.name}`);
                    finalPrompt = `${character.name}, ${charDna}, ${finalPrompt}`;
                }
            }
        }
        input.payload.prompt = `${finalPrompt}, ${GUOMAN_STYLE}`;
        input.payload.negative_prompt = input.payload.negative_prompt || NEGATIVE;
        if (characterId && this.characterService) {
            const character = await this.characterService.findOne(characterId);
            const attrs = (character?.attributes || {});
            if (attrs.fixed_seed) {
                input.payload.seed = parseInt(attrs.fixed_seed);
                this.logger.log(`[ShotRenderRouter] Locked SEED ${input.payload.seed} for character ${character?.name}`);
            }
            if (attrs.preferred_checkpoint) {
                input.payload.checkpoint = attrs.preferred_checkpoint;
            }
        }
        input.payload.cameraMovement =
            input.payload.cameraMovement ||
                input.context?.cameraMovement ||
                aestheticResult.suggestedCamera;
        input.payload.shotType = input.payload.shotType || input.context?.shotType;
        let result = await adapter.invoke(input);
        if (result.status === 'SUCCESS' && result.output) {
            const output = result.output;
            const isImage = (output.asset?.uri || '').match(/\.(png|webp|jpg|jpeg)$/i) ||
                output.localPath?.match(/\.(png|webp|jpg|jpeg)$/i);
            if (isImage) {
                this.logger.log(`[ShotRenderRouter] Detected IMAGE output from ${provider}. Enriching to 2.5D Video via local FFmpeg...`);
                const repoRoot = this.getRepoRoot();
                const rawSource = output.localPath || output?.asset?.uri;
                if (!rawSource) {
                    this.logger.error(`[ShotRenderRouter] Enrichment FAILED: rawSource is missing.`);
                    return result;
                }
                const absSourcePath = path.isAbsolute(rawSource)
                    ? rawSource
                    : path.resolve(repoRoot, rawSource);
                this.logger.log(`[ShotRenderRouter] Resolved absolute source path: ${absSourcePath}`);
                const shimInput = {
                    ...input,
                    payload: {
                        ...input.payload,
                        sourceImagePath: absSourcePath,
                    },
                };
                const enrichmentResult = await this.localAdapter.invoke(shimInput);
                if (enrichmentResult.status === 'SUCCESS') {
                    this.logger.log(`[ShotRenderRouter] Enrichment SUCCESS: ${enrichmentResult.output?.localPath}`);
                    const enrichedOutput = enrichmentResult.output;
                    result = {
                        ...result,
                        output: {
                            ...output,
                            asset: {
                                ...(output.asset || {}),
                                uri: enrichedOutput.storageKey || enrichedOutput.localPath,
                                sha256: enrichedOutput.sha256 || undefined,
                            },
                            localPath: enrichedOutput.localPath,
                            render_meta: {
                                ...(output.render_meta || {}),
                                enriched_by: 'shot_render_local',
                                video_duration: enrichedOutput.render_meta?.duration,
                            },
                        },
                    };
                }
                else {
                    this.logger.error(`[ShotRenderRouter] Enrichment FAILED: ${enrichmentResult.error?.message}. Falling back to image (Downstream may fail).`);
                }
            }
        }
        if (result.status === 'SUCCESS' && result.output) {
            const output = result.output;
            const prompt = input.payload.enrichedPrompt || input.payload.prompt || '';
            output.audit_trail = {
                ...output.audit_trail,
                providerSelected: provider,
                selectionReason: reason,
                routedBy: this.name,
                prompt_hash: (0, crypto_1.createHash)('sha256').update(prompt).digest('hex'),
                pricing_key: provider === 'replicate' ? 'REPLICATE_SDXL' : 'LOCAL_FREE',
            };
            if (process.env.ENGINE_REAL === '1' && provider !== 'mock') {
                await this.generateProvenanceKit(input, result, provider);
            }
        }
        return result;
    }
    async generateProvenanceKit(input, result, provider) {
        const output = result.output;
        if (!output)
            return;
        const renderMeta = output.render_meta || {};
        const asset = output.asset || {};
        const traceId = input.context?.traceId || input.context?.jobId;
        const jobId = input.context?.jobId;
        if (!jobId) {
            this.logger.warn(`[ShotRenderRouter] No jobId found in context for provenance tracking.`);
            return;
        }
        const localPath = asset?.uri || asset?.storageKey;
        if (!localPath || !fs.existsSync(localPath)) {
            this.logger.warn(`[ShotRenderRouter] Local artifact not found at ${localPath}, skipping provenance kit.`);
            return;
        }
        const artifactsDir = process.env.SSOT_ARTIFACTS_DIR || path.join(process.cwd(), 'docs/_evidence/week2_artifacts');
        if (!fs.existsSync(artifactsDir)) {
            fs.mkdirSync(artifactsDir, { recursive: true });
        }
        const targetMp4 = path.join(artifactsDir, 'shot_render_output.mp4');
        const targetSha = targetMp4 + '.sha256';
        const targetProv = path.join(artifactsDir, 'shot_render_output.provenance.json');
        const targetProvSha = targetProv + '.sha256';
        fs.copyFileSync(localPath, targetMp4);
        const sha256 = asset.sha256 || this.calculateSha256(targetMp4);
        const bytes = fs.statSync(targetMp4).size;
        let duration = renderMeta.duration_s || 2.0;
        try {
            const durStr = (0, child_process_1.execSync)(`ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "${targetMp4}"`)
                .toString()
                .trim();
            duration = parseFloat(durStr);
        }
        catch (e) {
        }
        const adapterVer = process.env.GIT_SHA || 'f9a6c0dc173a3309972e52597a2409733895412f';
        const provenance = {
            seal_type: 'REAL_ENGINE_ACCEPTANCE',
            artifact: {
                relpath: 'artifacts/shot_render_output.mp4',
                sha256: sha256,
                bytes: bytes,
                duration_s: duration,
            },
            producer: {
                kind: 'SHOT_RENDER',
                mode: 'REAL_ENGINE',
                engine_provider: provider,
                engine_model: renderMeta.engine_model || renderMeta.engine || 'unknown',
                engine_run_id: renderMeta.engine_run_id || traceId,
                adapter: renderMeta.engine || this.name,
                adapter_version: adapterVer,
            },
            job: {
                job_id: jobId,
                finished_at: new Date().toISOString(),
            },
            db: {
                job_table: 'shot_jobs',
                job_id_col: 'id',
                status_col: 'status',
                output_sha_col: 'outputSha256',
                engine_run_id_col: 'engineRunId',
                engine_provider_col: 'engineProvider',
                engine_model_col: 'engineModel',
            },
        };
        fs.writeFileSync(targetSha, sha256);
        fs.writeFileSync(targetProv, JSON.stringify(provenance, null, 2));
        const provSha = (0, crypto_1.createHash)('sha256').update(fs.readFileSync(targetProv)).digest('hex');
        fs.writeFileSync(targetProvSha, provSha);
        this.logger.log(`[ShotRenderRouter] Provenance kit generated for job ${jobId} in ${artifactsDir}`);
        try {
            await this.prisma.shotJob.update({
                where: { id: jobId },
                data: {
                    outputSha256: sha256,
                    engineProvider: provider,
                    engineRunId: provenance.producer.engine_run_id,
                    engineModel: provenance.producer.engine_model,
                },
            });
            this.logger.log(`[ShotRenderRouter] DB updated with provenance for job ${jobId}`);
        }
        catch (e) {
            this.logger.error(`[ShotRenderRouter] DB update failed: ${e.message}`);
        }
    }
    calculateSha256(filePath) {
        const hash = (0, crypto_1.createHash)('sha256');
        const buffer = fs.readFileSync(filePath);
        return hash.update(buffer).digest('hex');
    }
    getRepoRoot() {
        const repoRoot = process.env.SCU_REPO_ROOT || process.cwd();
        if (repoRoot.endsWith('apps/api')) {
            return path.resolve(repoRoot, '../../');
        }
        return path.resolve(repoRoot);
    }
    selectProvider() {
        const envProvider = (process.env.SHOT_RENDER_PROVIDER || 'replicate').toLowerCase();
        const engineMode = process.env.ENGINE_MODE || 'development';
        if (engineMode === 'production' && envProvider === 'mock') {
            throw new Error('PRODUCTION_SAFETY_ERROR: SHOT_RENDER_PROVIDER=mock is not allowed in ENGINE_MODE=production');
        }
        if (envProvider === 'local') {
            return { provider: 'local', reason: `Explicit SHOT_RENDER_PROVIDER=${envProvider}` };
        }
        if (envProvider === 'local_mps') {
            return { provider: 'local_mps', reason: `Explicit SHOT_RENDER_PROVIDER=${envProvider}` };
        }
        if (envProvider === 'comfyui') {
            return { provider: 'comfyui', reason: 'Explicit SHOT_RENDER_PROVIDER=comfyui' };
        }
        if (envProvider === 'fusion') {
            return { provider: 'fusion', reason: 'Explicit SHOT_RENDER_PROVIDER=fusion' };
        }
        if (envProvider === 'mock') {
            return { provider: 'mock', reason: 'Explicit SHOT_RENDER_PROVIDER=mock (Gate Mode)' };
        }
        if (envProvider === 'replicate') {
            if (!process.env.REPLICATE_API_TOKEN?.trim()) {
                throw new Error('JOB_CONFIG_INVALID: REPLICATE_API_TOKEN missing while SHOT_RENDER_PROVIDER=replicate. Production forbids silent fallback to mock/demo.');
            }
            return { provider: 'replicate', reason: 'Default/Explicit SHOT_RENDER_PROVIDER=replicate' };
        }
        throw new Error(`JOB_CONFIG_INVALID: Unknown SHOT_RENDER_PROVIDER="${envProvider}". Valid: replicate, comfyui, local, mock, fusion`);
    }
    getAdapter(provider) {
        if (provider === 'replicate') {
            return this.replicateAdapter;
        }
        else if (provider === 'comfyui') {
            return this.comfyuiAdapter;
        }
        else if (provider === 'mock') {
            return this.mockAdapter;
        }
        else if (provider === 'local_mps') {
            return this.mpsAdapter;
        }
        else if (provider === 'fusion') {
            return this.fusionAdapter;
        }
        else {
            return this.localAdapter;
        }
    }
    async coordinateStellarAesthetics(input) {
        this.logger.log(`[StellarCommand] Coordinating aesthetics for shot: ${input.payload.shotId}`);
        const pacingResult = await this.pacingAdapter.invoke({
            ...input,
            payload: { text: input.payload.prompt },
        });
        const tension = pacingResult.output?.tension_level || 'MEDIUM';
        const lightInput = {
            ...input,
            payload: {
                sceneId: input.payload.sceneId || 'generic_stellar',
                quality: 'production',
                lightSources: [
                    { type: 'rim', intensity: tension === 'HIGH' ? 1.5 : 0.8, color: '#ffffff' },
                    { type: 'volumetric', intensity: 0.5, color: '#aaeeff' },
                ],
            },
        };
        const lightingResult = await this.lightingAdapter.invoke(lightInput);
        const lightingMeta = lightingResult.output?.meta || {};
        const suggestedCamera = tension === 'HIGH' ? 'ZOOM_IN' : 'PAN_LEFT';
        let style = '(Masterpiece 3D CGI:2.2), (Perfect World aesthetic:2.0), (Unreal Engine 5.4 Cinematic Render:1.8), (High-end Chinese Animation style:1.8), (Subsurface Scattering skin:1.7), (Cinematic Rim Lighting:1.6), (Volumetric God Rays:1.5)';
        if (tension === 'HIGH') {
            style +=
                ', dramatic high-contrast lighting, sharp shadows, intense atmosphere, high-octane 3D rendering';
        }
        else {
            style += ', soft cinematic bloom, ethereal atmosphere, realistic materials';
        }
        const loraStyle = input.payload.desiredStyle || 'Style_FanRen';
        if (loraStyle === 'Style_Arcane') {
            style +=
                ', (Painting-like texture:1.5), (Arcane oil painting style:1.8), coarse brush strokes, stylized shading';
        }
        else if (loraStyle === 'Style_Ink') {
            style +=
                ', (Traditional Chinese ink wash style:1.8), (Water ink particles:1.5), flowing lines, ethereal smoke';
        }
        else {
            style += ', (Photorealistic 3D character:1.6), (Unreal Engine 5 quality:1.8)';
        }
        return {
            enrichedStyle: style,
            suggestedCamera,
            tension,
            lighting: lightingMeta,
        };
    }
    async mountCharacterLora(input) {
        try {
            const characterId = input.payload?.characterId;
            if (!characterId) {
                return;
            }
            this.logger.debug(`[ShotRenderRouter] Checking for LoRA for character: ${characterId}`);
            const character = this.characterService
                ? await this.characterService.findOne(characterId)
                : null;
            if (character?.loraModelId) {
                this.logger.log(`[ShotRenderRouter] Mounting LoRA for character "${character.name}": ${character.loraModelId}`);
                if (!input.payload.loras) {
                    input.payload.loras = [];
                }
                const existingLora = input.payload.loras.find((lora) => lora.modelId === character.loraModelId);
                if (!existingLora) {
                    input.payload.loras.push({
                        modelId: character.loraModelId,
                        triggerWord: character.nameEn || character.name,
                        weight: 1.0,
                        source: 'character_auto_mount',
                    });
                    this.logger.log(`[ShotRenderRouter] LoRA mounted successfully. Trigger word: "${character.nameEn || character.name}"`);
                }
                else {
                    this.logger.debug(`[ShotRenderRouter] LoRA already exists in payload, skipping`);
                }
            }
            else {
                this.logger.debug(`[ShotRenderRouter] No LoRA found for character ${characterId}`);
            }
        }
        catch (error) {
            this.logger.warn(`[ShotRenderRouter] Failed to mount LoRA: ${error.message}. Continuing without LoRA.`);
        }
    }
};
exports.ShotRenderRouterAdapter = ShotRenderRouterAdapter;
exports.ShotRenderRouterAdapter = ShotRenderRouterAdapter = ShotRenderRouterAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ModuleRef,
        prisma_service_1.PrismaService,
        shot_render_replicate_adapter_1.ShotRenderReplicateAdapter,
        shot_render_comfyui_adapter_1.ShotRenderComfyuiAdapter,
        shot_render_local_adapter_1.ShotRenderLocalAdapter,
        shot_render_mps_adapter_1.ShotRenderMpsAdapter,
        fusion_adapter_1.FusionAdapter,
        vg08_advanced_lighting_adapter_1.VG08AdvancedLightingAdapter,
        ce13_pacing_analyzer_adapter_1.CE13PacingAnalyzerAdapter])
], ShotRenderRouterAdapter);
//# sourceMappingURL=shot_render_router.adapter.js.map