import { ScriptBuildService } from './script-build.service';
export declare class ScriptBuildController {
    private readonly scriptBuildService;
    constructor(scriptBuildService: ScriptBuildService);
    getOutline(id: string): Promise<{
        build: {
            id: string;
            projectId: string;
            title: string;
            status: string;
            auditId: any;
            globalHash: string;
            createdAt: Date;
        };
        stats: {
            episodes: number;
            scenes: number;
            shots: number;
            characters: number;
            coveragePercent: any;
            totalBytes: number;
        };
        episodes: {
            id: string;
            index: number;
            title: string;
            startOffset: number | undefined;
            endOffset: number | undefined;
            scenes: {
                id: string;
                index: number;
                title: string;
                startOffset: number | undefined;
                endOffset: number | undefined;
                shots: {
                    id: string;
                    index: number;
                    summary: string | null;
                    startOffset: number | undefined;
                    endOffset: number | undefined;
                    sourceHash: string | undefined;
                }[];
            }[];
        }[];
    }>;
}
export declare class ShotsController {
    private readonly scriptBuildService;
    constructor(scriptBuildService: ScriptBuildService);
    getSource(id: string, context?: string): Promise<{
        shot: {
            id: string;
            buildId: string | null;
            summary: string | null;
        };
        source: {
            startOffset: number;
            endOffset: number;
            sourceHash: string;
            globalHash: string;
            excerpt: string;
            excerptStart: number;
            excerptEnd: number;
        };
    }>;
}
