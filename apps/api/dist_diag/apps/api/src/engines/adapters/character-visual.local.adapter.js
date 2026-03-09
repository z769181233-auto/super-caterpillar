"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CharacterVisualLocalAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterVisualLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
const perf_hooks_1 = require("perf_hooks");
let CharacterVisualLocalAdapter = CharacterVisualLocalAdapter_1 = class CharacterVisualLocalAdapter {
    name = 'character_visual';
    logger = new common_1.Logger(CharacterVisualLocalAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'character_visual';
    }
    async invoke(input) {
        const { characterId, projectId, traitsOverride = {} } = input.payload;
        const t0 = perf_hooks_1.performance.now();
        this.logger.log(`[CHAR_VISUAL_ASYNC] Resolving visual for ${characterId}`);
        return {
            status: shared_types_1.EngineInvokeStatus.SUCCESS,
            output: {
                characterId,
                traits: {
                    hair: 'black',
                    eyes: 'brown',
                    clothing: 'standard_scu_outfit',
                    ...traitsOverride,
                },
                audit_evidence: {
                    source: 'identity_anchor_v1_deterministic',
                    anchorId: `anchor_${characterId}`,
                    consistency_level: 'frozen',
                },
            },
            metrics: {
                durationMs: Math.round(perf_hooks_1.performance.now() - t0),
            },
        };
    }
};
exports.CharacterVisualLocalAdapter = CharacterVisualLocalAdapter;
exports.CharacterVisualLocalAdapter = CharacterVisualLocalAdapter = CharacterVisualLocalAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], CharacterVisualLocalAdapter);
//# sourceMappingURL=character-visual.local.adapter.js.map