import { projectApi } from '@/lib/apiClient';
import { ProjectCardView, adaptProjects } from './adapters';

export async function getProjects(): Promise<ProjectCardView[]> {
  const data = await projectApi.getProjects();
  return adaptProjects(data);
}

export async function createProject(data: { name: string; description?: string }) {
  return projectApi.createProject(data);
}

export async function deleteProject(projectId: string) {
  return projectApi.deleteProject(projectId);
}
