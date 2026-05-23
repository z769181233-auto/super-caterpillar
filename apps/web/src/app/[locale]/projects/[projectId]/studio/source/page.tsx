import { StudioSourcePage } from '@/features/studio-v2/StudioSourcePage';

interface Props {
  params: Promise<{
    locale: string;
    projectId: string;
  }>;
}

export default async function StudioSourceRoutePage(props: Props) {
  const { locale, projectId } = await props.params;
  return <StudioSourcePage locale={locale} projectId={projectId} />;
}
