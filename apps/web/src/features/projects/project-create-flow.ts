export interface CreateProjectPayload {
  name: string;
  description?: string;
}

export function normalizeCreateProjectPayload(
  name: string,
  description: string
): CreateProjectPayload {
  const normalizedName = name.trim();
  const normalizedDescription = description.trim();

  if (!normalizedName) {
    throw new Error('PROJECT_NAME_REQUIRED');
  }

  return {
    name: normalizedName,
    ...(normalizedDescription ? { description: normalizedDescription } : {}),
  };
}

export function getProjectDetailHref(locale: string, projectId: string): string {
  return `/${locale}/projects/${projectId}`;
}

export function getProjectsCreateHref(locale: string): string {
  return `/${locale}/projects?create=1`;
}
