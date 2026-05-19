import { redirect } from 'next/navigation';

export function generateStaticParams() {
  return [
    { projectId: 'demo' }
  ];
}

interface Props {
  params: Promise<{
    locale: string;
    projectId: string;
  }>;
}

export default async function ProjectStructureAliasPage(props: Props) {
  const { locale, projectId } = await props.params;

  // 旧结构页别名继续保留，只切到项目详情里的只读脚本/结构结果 tab。
  redirect(`/${locale}/projects/${projectId}?module=script`);
}
