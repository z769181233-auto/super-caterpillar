"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var VideoMergeLocalAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoMergeLocalAdapter = void 0;
const common_1 = require("@nestjs/common");
const shared_types_1 = require("@scu/shared-types");
const engines_video_merge_1 = require("@scu/engines-video-merge");
let VideoMergeLocalAdapter = VideoMergeLocalAdapter_1 = class VideoMergeLocalAdapter {
    name = 'video_merge';
    logger = new common_1.Logger(VideoMergeLocalAdapter_1.name);
    supports(engineKey) {
        return engineKey === 'video_merge';
    }
    async invoke(input) {
        this.logger.log(`Invoking VIDEO_RENDER Real Adapter for jobType=${input.jobType}`);
        try {
            const engineInput = {
                jobId: input.payload?.jobId || 'unknown',
                traceId: input.context?.traceId || 'unknown',
                framePaths: input.payload?.framePaths || [],
                fps: input.payload?.fps || 24,
                width: input.payload?.width || 512,
                height: input.payload?.height || 512,
            };
            const output = await (0, engines_video_merge_1.videoMergeRealEngine)(engineInput, input.context);
            return {
                status: shared_types_1.EngineInvokeStatus.SUCCESS,
                output,
                metrics: {
                    usage: output.billing_usage,
                },
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`VIDEO_RENDER Local execution failed: ${message}`);
            return {
                status: 'FAILED',
                error: {
                    message,
                    code: 'VIDEO_RENDER_LOCAL_ERR',
                },
            };
        }
    }
};
exports.VideoMergeLocalAdapter = VideoMergeLocalAdapter;
exports.VideoMergeLocalAdapter = VideoMergeLocalAdapter = VideoMergeLocalAdapter_1 = __decorate([
    (0, common_1.Injectable)()
], VideoMergeLocalAdapter);
//# sourceMappingURL=video_merge.adapter.js.map