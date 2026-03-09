"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityFeedbackService = void 0;
const common_1 = require("@nestjs/common");
let QualityFeedbackService = class QualityFeedbackService {
    evaluateQualityScores(records) {
        if (!records || records.length === 0) {
            return { avgScore: null, avgConfidence: null, total: 0 };
        }
        let scoreSum = 0;
        let scoreCount = 0;
        let confSum = 0;
        let confCount = 0;
        for (const r of records) {
            if (r.quality?.score != null) {
                scoreSum += r.quality.score;
                scoreCount++;
            }
            if (r.quality?.confidence != null) {
                confSum += r.quality.confidence;
                confCount++;
            }
        }
        return {
            avgScore: scoreCount ? scoreSum / scoreCount : null,
            avgConfidence: confCount ? confSum / confCount : null,
            total: records.length,
        };
    }
};
exports.QualityFeedbackService = QualityFeedbackService;
exports.QualityFeedbackService = QualityFeedbackService = __decorate([
    (0, common_1.Injectable)()
], QualityFeedbackService);
//# sourceMappingURL=quality-feedback.service.js.map