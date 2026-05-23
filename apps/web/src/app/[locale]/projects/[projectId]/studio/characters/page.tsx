import { StudioCharacterBiblePage } from '@/features/studio-v2/StudioCharacterBiblePage';

interface Props {
  params: Promise<{ locale: string; projectId: string }>;
}

export default async function CharactersPage(props: Props) {
  const { locale, projectId } = await props.params;
  return <StudioCharacterBiblePage locale={locale} projectId={projectId} />;
}
