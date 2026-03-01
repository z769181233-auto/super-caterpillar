import { VideoPlayerPageContent } from '@/features/projects/pages/VideoPlayerPageContent';

export function generateStaticParams() {
  return [
    { projectId: 'demo' }
  ];
}

export default function Page() {
  return <VideoPlayerPageContent />;
}
