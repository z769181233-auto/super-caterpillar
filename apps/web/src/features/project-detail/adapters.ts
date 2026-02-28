// Data Anti-Corruption Layer (ACL) for Project Detail
// Ensures that UI components only receive clean, default-fallback data.

export interface ProjectDetailView {
    id: string;
    name: string;
    organizationId: string;
    status: 'READY' | 'RUNNING' | 'ERROR' | 'DONE' | 'UNKNOWN';
    createdAt: string;
    updatedAt: string;
    stats: {
        buildsCount: number;
        structuralStatus: 'Audited' | 'Pending' | 'Unknown';
        usage: string;
    };
    audit: {
        fingerprintStatus: 'AUDITED' | 'SEALED' | 'UNKNOWN';
        rulesVersion: string;
    };
}

export interface BuildRowView {
    id: string;
    name: string;
    status: 'READY' | 'RUNNING' | 'ERROR' | 'DONE' | 'UNKNOWN';
    createdAt: string;
    metrics: {
        episodes: number | string;
        scenes: number | string;
        shots: number | string;
    };
}

export interface EvidenceSummaryView {
    globalHash?: { value?: string; source: 'server' | 'derived' | 'missing' };
    cid?: { value?: string; source: 'server' | 'derived' | 'missing' };
    buildId?: { value?: string; source: 'server' | 'derived' | 'missing' };
    verified?: { value?: boolean; source: 'server' | 'derived' | 'missing' };
    lastGeneratedAt: string;
    status: 'Verified' | 'Unverified' | 'Unknown';
}

// Adapters
export function adaptProjectDetail(raw: any): ProjectDetailView {
    return {
        id: raw?.id ?? 'unknown-id',
        name: raw?.name ?? 'Untitled Project',
        organizationId: raw?.organizationId ?? 'unknown-org',
        status: raw?.status ?? 'UNKNOWN',
        createdAt: raw?.createdAt ?? new Date().toISOString(),
        updatedAt: raw?.updatedAt ?? new Date().toISOString(),
        stats: {
            buildsCount: raw?.stats?.buildsCount ?? 0,
            structuralStatus: raw?.stats?.structuralStatus ?? 'Unknown',
            usage: raw?.stats?.usage ?? '--',
        },
        audit: {
            fingerprintStatus: raw?.audit?.fingerprintStatus ?? 'UNKNOWN',
            rulesVersion: raw?.audit?.rulesVersion ?? 'Unknown',
        }
    };
}

export function adaptBuildsList(rawList: any[]): BuildRowView[] {
    if (!Array.isArray(rawList)) return [];

    return rawList.map(raw => ({
        id: raw?.id ?? `build-${Math.random().toString(36).slice(2, 9)}`,
        name: raw?.name ?? 'Unnamed Build',
        status: raw?.status ?? 'UNKNOWN',
        createdAt: raw?.createdAt ?? new Date().toISOString(),
        metrics: {
            episodes: raw?.metrics?.episodes ?? '--',
            scenes: raw?.metrics?.scenes ?? '--',
            shots: raw?.metrics?.shots ?? '--',
        }
    }));
}

export function adaptEvidenceSummary(raw: any): EvidenceSummaryView {
    return {
        globalHash: { value: raw?.globalHash, source: raw?.globalHash ? 'server' : 'missing' },
        cid: { value: raw?.cid, source: raw?.cid ? 'server' : 'missing' },
        buildId: { value: raw?.buildId, source: raw?.buildId ? 'server' : 'missing' },
        verified: { value: raw?.verified, source: raw?.verified !== undefined ? 'server' : 'missing' },
        lastGeneratedAt: raw?.lastGeneratedAt ?? '--',
        status: raw?.status ?? 'Unknown',
    };
}
