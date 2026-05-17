import { StudioOverviewPage } from '@/features/studio-v2/StudioOverviewPage';

interface Props {
  params: Promise<{
    locale: string;
    projectId: string;
  }>;
}

export default async function StudioPage(props: Props) {
  const { locale, projectId } = await props.params;
  return <StudioOverviewPage locale={locale} projectId={projectId} />;
}
