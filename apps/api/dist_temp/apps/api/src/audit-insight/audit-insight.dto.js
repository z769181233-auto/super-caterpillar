"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovelAuditFullResponse = exports.DagRunSummaryDto = exports.VideoAssetDto = exports.DirectorAuditSummaryDto = exports.AuditJobSummaryDto = exports.JobAuditResponse = exports.MemoryUpdateArtifact = exports.NovelAnalysisArtifact = exports.VisualMetricArtifact = exports.NovelInsightResponse = void 0;
class NovelInsightResponse {
    novelSourceId;
    projectId;
    ce06;
    ce07;
    ce03_04;
}
exports.NovelInsightResponse = NovelInsightResponse;
class VisualMetricArtifact {
    jobId;
    type;
    status;
    score;
    output_summary;
    created_at;
}
exports.VisualMetricArtifact = VisualMetricArtifact;
class NovelAnalysisArtifact {
    jobId;
    workerId;
    createdAt;
    status;
    payload;
    result;
}
exports.NovelAnalysisArtifact = NovelAnalysisArtifact;
class MemoryUpdateArtifact {
    jobId;
    workerId;
    createdAt;
    status;
    payload;
    memoryContent;
}
exports.MemoryUpdateArtifact = MemoryUpdateArtifact;
class JobAuditResponse {
    jobId;
    type;
    status;
    workerId;
    createdAt;
    updatedAt;
    payload;
    result;
    auditLogs;
}
exports.JobAuditResponse = JobAuditResponse;
class AuditJobSummaryDto {
    jobId;
    traceId;
    status;
    createdAtIso;
    workerId;
}
exports.AuditJobSummaryDto = AuditJobSummaryDto;
class DirectorAuditSummaryDto {
    mode;
    shotsEvaluated;
    isValid;
    violationsCount;
    suggestionsCount;
    violationsSample;
    computedAtIso;
}
exports.DirectorAuditSummaryDto = DirectorAuditSummaryDto;
class VideoAssetDto {
    status;
    secureUrl;
    jobId;
    assetId;
    storageKey;
}
exports.VideoAssetDto = VideoAssetDto;
class DagRunSummaryDto {
    traceId;
    timeline;
    missingPhases;
    builtFrom;
    builtAtIso;
}
exports.DagRunSummaryDto = DagRunSummaryDto;
class NovelAuditFullResponse {
    novelSourceId;
    projectId;
    latestJobs;
    metrics;
    director;
    dag;
    videoAsset;
}
exports.NovelAuditFullResponse = NovelAuditFullResponse;
//# sourceMappingURL=audit-insight.dto.js.map