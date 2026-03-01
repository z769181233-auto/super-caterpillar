import type { ProjectCardView } from './mock';

// Adapter to transform backend project schema to Frontend UI schema (ProjectCardView)
export function adaptProjects(rawProjects: any[]): ProjectCardView[] {
  if (!Array.isArray(rawProjects)) return [];

  return rawProjects.map((raw: any) => {
    // Determine status string
    let latestStatus: 'READY' | 'RUNNING' | 'ERROR' | 'DONE' = 'READY';
    const rawStatus = (raw.status || '').toUpperCase();
    if (['READY', 'RUNNING', 'ERROR', 'DONE'].includes(rawStatus)) {
      latestStatus = rawStatus as any;
    }

    return {
      id: raw.id || `temp-${Math.random()}`,
      title: raw.name || 'Untitled Project',
      updatedAt: raw.createdAt || new Date().toISOString(),
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
