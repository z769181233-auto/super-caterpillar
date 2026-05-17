import { StudioEpisodePlanPage } from '@/features/studio-v2/StudioEpisodePlanPage';

interface Props {
  params: Promise<{ locale: string; projectId: string }>;
}

export default async function EpisodesPage(props: Props) {
  const { locale, projectId } = await props.params;
  return <StudioEpisodePlanPage locale={locale} projectId={projectId} />;
}
