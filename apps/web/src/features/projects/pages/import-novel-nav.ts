export function buildImportNovelNav(locale: string, projectId: string) {
  return {
    projectHref: `/${locale}/projects/${projectId}`,
    structureHref: `/${locale}/projects/${projectId}/structure`,
  };
}
