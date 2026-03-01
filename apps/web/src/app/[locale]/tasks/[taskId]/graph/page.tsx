import { TaskGraphPageContent } from '@/features/tasks/pages/TaskGraphPageContent';

export function generateStaticParams() {
  return [
    { taskId: 'demo' }
  ];
}

export default function Page() {
  return <TaskGraphPageContent />;
}
