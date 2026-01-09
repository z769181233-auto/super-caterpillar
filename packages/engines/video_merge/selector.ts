import { VideoMergeInput, VideoMergeOutput } from './types';
import { videoMergeRealEngine } from './real';

export async function videoMergeSelector(input: VideoMergeInput): Promise<VideoMergeOutput> {
    const mode = process.env.VIDEO_MERGE_MODE || 'REAL';

    if (mode === 'REAL') {
        return videoMergeRealEngine(input);
    }

    // Default to REAL for P0-R1
    return videoMergeRealEngine(input);
}

export const videoMergeEngineSelector = {
    REAL: videoMergeRealEngine,
};
