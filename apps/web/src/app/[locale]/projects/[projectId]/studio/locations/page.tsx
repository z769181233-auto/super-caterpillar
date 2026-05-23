import { StudioLocationBiblePage } from '@/features/studio-v2/StudioLocationBiblePage';

interface Props {
  params: Promise<{ locale: string; projectId: string }>;
}

export default async function LocationsPage(props: Props) {
  const { locale, projectId } = await props.params;
  return <StudioLocationBiblePage locale={locale} projectId={projectId} />;
}
