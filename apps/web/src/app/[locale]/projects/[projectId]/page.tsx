import React from 'react';
import { ProjectDetailPage } from '@/features/projects/pages/ProjectDetailPage';

export function generateStaticParams() {
  return [
    { projectId: 'demo' }
  ];
}

export default function ProjectPage() {
  return <ProjectDetailPage />;
}
