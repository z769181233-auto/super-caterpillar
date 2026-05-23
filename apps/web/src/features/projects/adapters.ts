export interface ProjectCardView {
  id: string;
  title: string;
  updatedAt: string;
  latestBuild?: {
    id: string;
    status: 'READY' | 'RUNNING' | 'ERROR' | 'DONE';
    audited: boolean;
    sealed: boolean;
  };
  stats?: {
    seasons: number;
    episodes: number;
    scenes: number;
    shots: number;
  };
  tags: string[];
}

type RawProjectStats = {
  seasonsCount?: number;
  scenesCount?: number;
  shotsCount?: number;
};

type RawProjectCard = {
  id?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  hasVideo?: boolean;
  stats?: RawProjectStats;
};

const PROJECT_CARD_STATUSES = ['READY', 'RUNNING', 'ERROR', 'DONE'] as const;

// Adapter to transform backend project schema to Frontend UI schema (ProjectCardView)
export function adaptProjects(rawProjects: RawProjectCard[]): ProjectCardView[] {
  if (!Array.isArray(rawProjects)) return [];

  return rawProjects.map((raw, index) => {
    let latestStatus: 'READY' | 'RUNNING' | 'ERROR' | 'DONE' = 'READY';
    const rawStatus = String(raw.status || '').toUpperCase();

    if (rawStatus === 'IN_PROGRESS' || rawStatus === 'PENDING' || rawStatus === 'RUNNING') {
      latestStatus = 'RUNNING';
    } else if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
      latestStatus = 'ERROR';
    } else if (rawStatus === 'DONE' || rawStatus === 'SUCCEEDED' || rawStatus === 'COMPLETED') {
      latestStatus = 'DONE';
    } else if (
      PROJECT_CARD_STATUSES.includes(rawStatus as (typeof PROJECT_CARD_STATUSES)[number])
    ) {
      latestStatus = rawStatus as 'READY' | 'RUNNING' | 'ERROR' | 'DONE';
    }

    return {
      id: raw.id || `temp-project-${index}`,
      title: raw.name || 'Untitled Project',
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
      latestBuild: {
        id: `build-${raw.id || 'x'}`,
        status: latestStatus,
        audited: raw.hasVideo ? true : false,
        sealed: rawStatus === 'DONE' ? true : false,
      },
      stats: {
        seasons: raw.stats?.seasonsCount || 0,
        episodes: Math.max(1, raw.stats?.scenesCount || 1), // rough mapping
        scenes: raw.stats?.scenesCount || 0,
        shots: raw.stats?.shotsCount || 0,
      },
      tags: [],
    };
  });
}
