import { StudioShellPage } from '@/features/studio/pages/StudioShellPage';

export function generateStaticParams() {
  return [{ id: 'demo' }];
}

export default function ScriptBuildPage() {
  return <StudioShellPage />;
}
