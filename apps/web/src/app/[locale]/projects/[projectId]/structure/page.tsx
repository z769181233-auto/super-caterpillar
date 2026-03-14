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

  // 核心逻辑：重定向到项目详情页，并带上 module=structure 参数
  redirect(`/${locale}/projects/${projectId}?module=structure`);
}
