import { AuditPageContent } from '@/features/studio/pages/AuditPageContent';

export function generateStaticParams() {
  return [
    { novelSourceId: 'demo' }
  ];
}

export default function Page() {
  return <AuditPageContent />;
}
