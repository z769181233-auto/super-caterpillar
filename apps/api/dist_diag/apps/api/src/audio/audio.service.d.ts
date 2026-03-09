import { AudioSynthesisOutput } from './providers/audio-provider.interface';
import { OpsMetricsService } from '../ops/ops-metrics.service';
export type AudioProjectSettings = {
    audioRealEnabled?: boolean;
    audioBgmEnabled?: boolean;
    audioMixerEnabled?: boolean;
    audioBgmLibraryId?: string;
};
export interface PrismaLike {
    project: {
        findUnique(args: any): Promise<any>;
    };
}
export type AudioGenerateRequest = {
    text: string;
    projectSettings?: AudioProjectSettings;
    bgmSeed?: string;
    preview?: boolean;
    previewCapMs?: number;
};
export type AudioGenerateResult = {
    voice: AudioSynthesisOutput;
    mixed?: {
        absPath: string;
        sha256: string;
    };
    bgm?: AudioSynthesisOutput;
    signals: Record<string, any>;
};
export declare class AudioService {
    private readonly metrics;
    private readonly stubProvider;
    private readonly realProvider;
    private readonly bgmProvider;
    constructor(metrics: OpsMetricsService);
    resolveProjectSettings(prisma: PrismaLike, projectId: string): Promise<AudioProjectSettings>;
    private isKillSwitchOn;
    generateAndMix(req: AudioGenerateRequest): Promise<AudioGenerateResult>;
    generateBgm(req: AudioGenerateRequest): Promise<AudioSynthesisOutput>;
}
