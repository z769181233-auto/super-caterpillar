export interface AnalyzedShot {
    index: number;
    title?: string;
    summary?: string;
    text?: string;
    shotType?: string;
    emotion?: string;
    novelQuote?: string;
    durationSec?: number;
}
export interface AnalyzedScene {
    index: number;
    title: string;
    summary: string;
    shots: AnalyzedShot[];
}
export interface AnalyzedEpisode {
    index: number;
    title: string;
    summary: string;
    scenes: AnalyzedScene[];
}
export interface AnalyzedSeason {
    index: number;
    title: string;
    summary: string;
    episodes: AnalyzedEpisode[];
}
export interface AnalyzedProjectStructure {
    projectId: string;
    seasons?: AnalyzedSeason[];
    episodes: AnalyzedEpisode[];
    stats: {
        seasonsCount: number;
        episodesCount: number;
        scenesCount: number;
        shotsCount: number;
    };
}
export type NovelAnalysisStatus = 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED';
