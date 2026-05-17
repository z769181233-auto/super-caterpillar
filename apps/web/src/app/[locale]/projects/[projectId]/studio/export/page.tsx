import { StudioModulePlaceholder } from '@/features/studio-v2/StudioModulePlaceholder';
import { studioModuleConfigs } from '@/features/studio-v2/module-configs';

interface Props {
  params: Promise<{ locale: string; projectId: string }>;
}

export default async function ExportPage(props: Props) {
  const { locale, projectId } = await props.params;
  return <StudioModulePlaceholder locale={locale} projectId={projectId} config={studioModuleConfigs.export} />;
}
