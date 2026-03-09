"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticEnhancementLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
let SemanticEnhancementLocalAdapter = class SemanticEnhancementLocalAdapter {
    name = 'SemanticEnhancementLocalAdapter';
    mode = 'local';
    supports(engineKey) {
        return engineKey === 'semantic_enhancement';
    }
    async invoke(input) {
        const payload = input.payload;
        const text = payload?.text || '';
        await new Promise((resolve) => setTimeout(resolve, 500));
        const summary = text.length > 50 ? text.substring(0, 47) + '...' : text || 'No content provided.';
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to']);
        const keywords = Array.from(new Set(text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter((w) => w.length > 3 && !stopWords.has(w))
            .sort((a, b) => b.length - a.length)
            .slice(0, 8)));
        if (keywords.length === 0)
            keywords.push('scene', 'draft');
        return {
            status: shared_types_1.EngineInvokeStatus.SUCCESS,
            output: {
                summary: `[AI Analysis] ${summary}`,
                keywords,
                emotion: ['neutral'],
                entities: [],
            },
        };
    }
};
exports.SemanticEnhancementLocalAdapter = SemanticEnhancementLocalAdapter;
exports.SemanticEnhancementLocalAdapter = SemanticEnhancementLocalAdapter = __decorate([
    (0, common_1.Injectable)()
], SemanticEnhancementLocalAdapter);
//# sourceMappingURL=semantic-enhancement.local-adapter.js.map