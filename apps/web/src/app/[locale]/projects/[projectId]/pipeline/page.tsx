import { PipelinePageContent } from '@/features/projects/pages/PipelinePageContent';

export function generateStaticParams() {
  return [
    { projectId: 'demo' }
  ];
}

export default function Page() {
  return <PipelinePageContent />;
}
