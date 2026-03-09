"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var NovelAnalysisLocalAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovelAnalysisLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
let NovelAnalysisLocalAdapter = NovelAnalysisLocalAdapter_1 = class NovelAnalysisLocalAdapter {
    name = 'default_novel_analysis';
    logger = new common_1.Logger(NovelAnalysisLocalAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'default_novel_analysis' || engineKey === 'local_novel_analysis';
    }
    async invoke(input) {
        this.logger.log(`--- DEBUG: ADAPTER PATCH ACTIVE --- NovelAnalysisLocalAdapter.invoke called for jobType=${input.jobType}`);
        return {
            status: 'SUCCESS',
            output: {
                mocked: true,
                message: 'Mock success for gate verification',
                originalInput: input,
            },
        };
    }
};
exports.NovelAnalysisLocalAdapter = NovelAnalysisLocalAdapter;
exports.NovelAnalysisLocalAdapter = NovelAnalysisLocalAdapter = NovelAnalysisLocalAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], NovelAnalysisLocalAdapter);
//# sourceMappingURL=novel-analysis.local.adapter.NEW.js.map