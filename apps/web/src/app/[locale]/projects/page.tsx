import { ProjectsGridPage } from '@/features/projects/ProjectsGridPage';

interface ProjectsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const create = resolvedSearchParams?.create;
  const initialCreateOpen = Array.isArray(create) ? create.includes('1') : create === '1';

  return <ProjectsGridPage initialCreateOpen={initialCreateOpen} />;
}
