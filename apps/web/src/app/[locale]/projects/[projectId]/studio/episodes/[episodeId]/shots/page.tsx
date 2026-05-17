import { StudioShotScriptPage } from '@/features/studio-v2/StudioShotScriptPage';

interface Props {
  params: Promise<{ locale: string; projectId: string; episodeId: string }>;
}

export default async function ShotsPage(props: Props) {
  const { locale, projectId, episodeId } = await props.params;
  return <StudioShotScriptPage locale={locale} projectId={projectId} episodeId={episodeId} />;
}
