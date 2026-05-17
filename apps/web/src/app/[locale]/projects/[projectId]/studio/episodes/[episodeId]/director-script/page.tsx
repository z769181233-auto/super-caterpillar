import { StudioDirectorScriptPage } from '@/features/studio-v2/StudioDirectorScriptPage';

interface Props {
  params: Promise<{ locale: string; projectId: string; episodeId: string }>;
}

export default async function DirectorScriptPage(props: Props) {
  const { locale, projectId, episodeId } = await props.params;
  return <StudioDirectorScriptPage locale={locale} projectId={projectId} episodeId={episodeId} />;
}
