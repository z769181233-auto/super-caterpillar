import type { ProjectCardView } from './adapters';
import type { ProjectDetailView } from '@/features/project-detail/adapters';

const ACTIVE_CARD_STATUSES = new Set(['RUNNING']);
const ACTIVE_NOVEL_STATUSES = new Set(['PENDING', 'RUNNING', 'ANALYZING', 'RETRYING']);

export const PROJECT_STATUS_POLL_INTERVAL_MS = 5000;

export function shouldPollProjects(projects: ProjectCardView[] | null | undefined): boolean {
  if (!projects || projects.length === 0) return false;
  return projects.some((project) => ACTIVE_CARD_STATUSES.has(String(project.latestBuild?.status || '').toUpperCase()));
}

export function shouldPollProjectDetail(project: ProjectDetailView | null | undefined): boolean {
  if (!project) return false;

  const normalizedProjectStatus = String(project.status || '').toUpperCase();
  const normalizedNovelStatus = String(project.stats?.novelAnalysisStatus || '').toUpperCase();

  return ACTIVE_CARD_STATUSES.has(normalizedProjectStatus) || ACTIVE_NOVEL_STATUSES.has(normalizedNovelStatus);
}
