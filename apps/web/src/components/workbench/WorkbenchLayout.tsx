'use client';

import React, { useState, ReactNode } from 'react';
import { WorkbenchSidebar, WorkbenchModule } from '@/components/workbench/WorkbenchSidebar';

interface WorkbenchLayoutProps {
  children?: ReactNode;
  defaultModule?: WorkbenchModule;
  renderModule: (module: WorkbenchModule) => ReactNode;
  header?: ReactNode;
}
export function WorkbenchLayout({
  defaultModule = 'overview',
  renderModule,
  header,
}: WorkbenchLayoutProps) {
  const [selectedModule, setSelectedModule] = useState<WorkbenchModule | null>(null);
  const currentModule = selectedModule ?? defaultModule;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#fff' }}>
      {/* Sidebar */}
      <WorkbenchSidebar currentModule={currentModule} onModuleChange={setSelectedModule} />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Global Header (Optional) */}
        {header && (
          <div
            style={{
              height: '60px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              alignItems: 'center',
              padding: '0 24px',
              backgroundColor: '#fff',
            }}
          >
            {header}
          </div>
        )}

        {/* Dynamic Module Content */}
        <div
          style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fafafa', position: 'relative' }}
        >
          {renderModule(currentModule)}
        </div>
      </div>
    </div>
  );
}
