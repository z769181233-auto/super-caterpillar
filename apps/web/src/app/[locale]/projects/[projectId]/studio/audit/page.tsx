import { StudioAuditPage } from '@/features/studio-v2/StudioAuditPage';

interface Props {
  params: Promise<{
    locale: string;
    projectId: string;
  }>;
}

export default async function StudioAuditRoutePage(props: Props) {
  const { locale, projectId } = await props.params;
  return <StudioAuditPage locale={locale} projectId={projectId} />;
}
