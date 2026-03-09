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
var G5AssetLayeringResolverAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.G5AssetLayeringResolverAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let G5AssetLayeringResolverAdapter = G5AssetLayeringResolverAdapter_1 = class G5AssetLayeringResolverAdapter {
    name = 'g5_asset_layering';
    logger = new common_1.Logger(G5AssetLayeringResolverAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'g5_asset_layering';
    }
    async invoke(input) {
        const started = Date.now();
        try {
            const { renderPlan, charactersDir, outputDir } = input.payload;
            if (!renderPlan) {
                throw new Error('G5_ASSET_LAYER: Missing renderPlan in payload');
            }
            const shots = renderPlan.renderShots || renderPlan.shots || [];
            const assignments = [];
            const defaultCharsDir = charactersDir || path.join(process.cwd(), 'assets/characters/v1');
            shots.forEach((shot) => {
                const shotId = shot.id || `shot-${shot.sequence_no || 0}`;
                const characterId = shot.characterId;
                if (!characterId) {
                    assignments.push({ shotId, layers: [], status: 'NO_ACTOR' });
                    return;
                }
                const charBase = path.join(defaultCharsDir, characterId);
                const layers = [];
                const compDir = path.join(charBase, 'components');
                if (fs.existsSync(compDir)) {
                    const comps = ['torso.png', 'head.png', 'arms.png'];
                    comps.forEach((c, idx) => {
                        const p = path.join(compDir, c);
                        if (fs.existsSync(p)) {
                            layers.push({
                                layerId: c.replace('.png', ''),
                                sourcePath: p,
                                order: (idx + 1) * 10,
                                offset: { x: 0, y: 0 },
                            });
                        }
                    });
                }
                if (layers.length === 0) {
                    const full = path.join(charBase, 'full.png');
                    if (fs.existsSync(full)) {
                        layers.push({
                            layerId: 'full',
                            sourcePath: full,
                            order: 10,
                            offset: { x: 0, y: 0 },
                        });
                    }
                }
                const shadow = {
                    enabled: true,
                    type: 'ellipse_soft',
                    params: { color: '#000000', opacity: 0.4, blur: 15, offset: { x: 0, y: 40 } },
                };
                assignments.push({
                    shotId,
                    characterId,
                    layers: layers.sort((a, b) => a.order - b.order),
                    shadow,
                    blending: { mode: 'normal', feather: 2 },
                });
            });
            const result = {
                assignments,
                total_shots: shots.length,
                asset_base: defaultCharsDir,
            };
            if (outputDir) {
                const outPath = path.join(outputDir, 'layering_plan.json');
                fs.mkdirSync(outputDir, { recursive: true });
                fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
            }
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output: result,
                metrics: {
                    durationMs: Date.now() - started,
                },
            };
        }
        catch (error) {
            this.logger.error(`[G5-LAYER] Error: ${error.message}`);
            return {
                status: shared_types_1.EngineInvokeStatus.FAILED,
                error: {
                    code: 'G5_LAYER_ERROR',
                    message: error.message,
                },
            };
        }
    }
};
exports.G5AssetLayeringResolverAdapter = G5AssetLayeringResolverAdapter;
exports.G5AssetLayeringResolverAdapter = G5AssetLayeringResolverAdapter = G5AssetLayeringResolverAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], G5AssetLayeringResolverAdapter);
//# sourceMappingURL=g5-asset-layering-resolver.adapter.js.map