export type MixInput = {
    voiceWavPath: string;
    bgmWavPath: string;
    outWavPath: string;
    duckingRatio?: number;
    fadeMs?: number;
    durationMs?: number;
};
export declare function sha256File(absPath: string): string;
export declare function mixWithDucking(input: MixInput): Promise<{
    outSha256: string;
}>;
