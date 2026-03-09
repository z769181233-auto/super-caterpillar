import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { ProjectResolver } from '../common/project-resolver';
export declare class IdentityConsistencyService {
    private readonly prisma;
    private readonly storage;
    private readonly projectResolver;
    private readonly logger;
    constructor(prisma: PrismaService, storage: LocalStorageService, projectResolver: ProjectResolver);
    scoreIdentity(referenceAssetId: string, targetAssetId: string, characterId: string, shotId?: string): Promise<{
        score: number;
        verdict: 'PASS' | 'FAIL';
        details: any;
    }>;
    scoreIdentityReal(referenceAssetId: string, targetAssetId: string, characterId: string): Promise<{
        score: number;
        verdict: 'PASS' | 'FAIL';
        details: any;
    }>;
    scoreIdentityStub(referenceAssetId: string, targetAssetId: string, characterId: string): Promise<{
        score: number;
        verdict: 'PASS' | 'FAIL';
        details: any;
    }>;
    recordScore(shotId: string, characterId: string, referenceAnchorId: string, targetAssetId: string, scoreData: {
        score: number;
        verdict: 'PASS' | 'FAIL';
        details: any;
    }): Promise<{
        id: string;
        details: import("../../../../packages/database/dist/generated/prisma/runtime/library").JsonValue;
        createdAt: Date;
        shotId: string;
        verdict: string;
        characterId: string;
        referenceAnchorId: string;
        targetAssetId: string;
        identityScore: number;
    }>;
}
