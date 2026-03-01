import { ReviewQueuePageContent } from '@/features/projects/pages/ReviewQueuePageContent';

export function generateStaticParams() {
  return [
    { projectId: 'demo' }
  ];
}

export default function Page() {
  return <ReviewQueuePageContent />;
}
