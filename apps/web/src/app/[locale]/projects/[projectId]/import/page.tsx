import { MinimalImportPageContent } from '@/features/projects/pages/MinimalImportPageContent';

export function generateStaticParams() {
  return [
    { projectId: 'demo' }
  ];
}

export default function Page() {
  return <MinimalImportPageContent />;
}
