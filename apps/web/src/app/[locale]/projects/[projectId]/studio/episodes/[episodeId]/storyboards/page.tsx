import { StudioStoryboardAssetPage } from '@/features/studio-v2/StudioStoryboardAssetPage';

interface Props {
  params: Promise<{ locale: string; projectId: string; episodeId: string }>;
}

export default async function StoryboardsPage(props: Props) {
  const { locale, projectId, episodeId } = await props.params;
  return (
    <StudioStoryboardAssetPage locale={locale} projectId={projectId} episodeId={episodeId} />
  );
}
