import { StudioStoryBiblePage } from '@/features/studio-v2/StudioStoryBiblePage';

interface Props {
  params: Promise<{ locale: string; projectId: string }>;
}

export default async function StoryBiblePage(props: Props) {
  const { locale, projectId } = await props.params;
  return <StudioStoryBiblePage locale={locale} projectId={projectId} />;
}
