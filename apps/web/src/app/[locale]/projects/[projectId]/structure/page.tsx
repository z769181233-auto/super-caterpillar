import { redirect } from 'next/navigation';

interface Props {
  params: {
    locale: string;
    projectId: string;
  };
}

export default function ProjectStructureAliasPage({ params }: Props) {
  const { locale, projectId } = params;

  // 核心逻辑：重定向到项目详情页，并带上 module=structure 参数
  redirect(`/${locale}/projects/${projectId}?module=structure`);
}
