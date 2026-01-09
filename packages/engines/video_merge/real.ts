import { VideoMergeInput, VideoMergeOutput } from './types';
import { runVideoMergeLocal } from './real/local.adapter';

export async function videoMergeRealEngine(
    input: VideoMergeInput,
    ctx: any = {}
): Promise<VideoMergeOutput> {
    return runVideoMergeLocal(input, ctx);
}
