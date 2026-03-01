import { ImportNovelPageContent } from '@/features/projects/pages/ImportNovelPageContent';

export function generateStaticParams() {
  return [
    { projectId: 'demo' }
  ];
}

export default function Page() {
  return <ImportNovelPageContent />;
}
