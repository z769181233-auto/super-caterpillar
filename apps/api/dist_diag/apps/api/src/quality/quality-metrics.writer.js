"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var QualityMetricsWriter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityMetricsWriter = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("database");
let QualityMetricsWriter = QualityMetricsWriter_1 = class QualityMetricsWriter {
    prisma;
    logger = new common_1.Logger(QualityMetricsWriter_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async writeQualityMetrics(params) {
        try {
            const { jobId, jobType, projectId, traceId, result } = params;
            if (jobType !== database_1.JobType.CE03_VISUAL_DENSITY &&
                jobType !== database_1.JobType.CE04_VISUAL_ENRICHMENT) {
                return false;
            }
            const resultPayload = result || {};
            const engine = jobType === database_1.JobType.CE03_VISUAL_DENSITY ? 'CE03' : 'CE04';
            let visualDensityScore;
            let enrichmentQuality;
            let metadata = {};
            if (jobType === database_1.JobType.CE03_VISUAL_DENSITY) {
                visualDensityScore =
                    resultPayload.visualDensityScore ||
                        resultPayload.visual_density_score ||
                        resultPayload.score ||
                        undefined;
                metadata = {
                    ...resultPayload,
                };
            }
            else if (jobType === database_1.JobType.CE04_VISUAL_ENRICHMENT) {
                enrichmentQuality =
                    resultPayload.enrichmentQuality ||
                        resultPayload.enrichment_quality ||
                        resultPayload.quality ||
                        undefined;
                metadata = {
                    ...resultPayload,
                };
            }
            if (visualDensityScore !== undefined || enrichmentQuality !== undefined) {
                const finalMetadata = {
                    ...metadata,
                    jobId,
                    traceId: traceId || undefined,
                    engineKey: engine === 'CE03' ? 'ce03_visual_density' : 'ce04_visual_enrichment',
                };
                await this.prisma.qualityMetrics.create({
                    data: {
                        projectId,
                        engine,
                        jobId,
                        traceId,
                        visualDensityScore,
                        enrichmentQuality,
                        metadata: finalMetadata,
                    },
                });
                this.logger.log(`QualityMetrics created for ${engine} job ${jobId}, project ${projectId} (traceId: ${traceId || 'N/A'})`);
                return true;
            }
            else {
                this.logger.warn(`No quality metrics found in result for ${engine} job ${jobId}, skipping QualityMetrics write`);
                return false;
            }
        }
        catch (error) {
            this.logger.error(`Failed to write QualityMetrics for job ${params.jobId}: ${error.message}`, error.stack);
            return false;
        }
    }
};
exports.QualityMetricsWriter = QualityMetricsWriter;
exports.QualityMetricsWriter = QualityMetricsWriter = QualityMetricsWriter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QualityMetricsWriter);
//# sourceMappingURL=quality-metrics.writer.js.map