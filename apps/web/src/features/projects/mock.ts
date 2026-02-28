// Contract for the Dashboard Projects
// No UI texts, only data structures

export interface ProjectCardView {
    id: string;
    title: string;
    updatedAt: string;
    latestBuild?: {
        id: string;
        status: 'READY' | 'RUNNING' | 'ERROR' | 'DONE';
        progress?: number;
        audited?: boolean;
        sealed?: boolean;
    };
    stats?: {
        seasons: number;
        episodes: number;
        scenes: number;
        shots: number;
    };
    tags?: string[];
    owner?: {
        name: string;
        avatarUrl?: string;
    };
}

export const mockProjects: ProjectCardView[] = [
    {
        id: 'proj-001',
        title: 'Cyberpunk Origin',
        updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
        latestBuild: {
            id: 'bld-001',
            status: 'DONE',
            audited: true,
            sealed: false,
        },
        stats: {
            seasons: 1,
            episodes: 2,
            scenes: 15,
            shots: 120,
        },
        tags: ['Sci-Fi', 'Industrial'],
    },
    {
        id: 'proj-002',
        title: 'The Great Revival',
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
        latestBuild: {
            id: 'bld-002',
            status: 'DONE',
            audited: true,
            sealed: true,
        },
        stats: {
            seasons: 3,
            episodes: 36,
            scenes: 420,
            shots: 10500,
        },
        tags: ['Fantasy', 'Demo'],
    },
    {
        id: 'proj-003',
        title: 'Project X - Teaser',
        updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
        latestBuild: {
            id: 'bld-003',
            status: 'RUNNING',
            progress: 45,
        },
        stats: {
            seasons: 0,
            episodes: 1,
            scenes: 3,
            shots: 45,
        },
    },
];
