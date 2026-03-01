'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, icon, actionText, onAction }: EmptyStateProps) {
  return (
    <div
      className="flex-center flex-col p-12 text-center animate-fade-in"
      style={{ gap: '1.5rem', minHeight: '300px' }}
    >
      {icon && (
        <div className="text-muted" style={{ fontSize: '3rem' }}>
          {icon}
        </div>
      )}
      <div style={{ maxWidth: '400px' }}>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          {title}
        </h3>
        {description && <p style={{ color: 'var(--text-muted)' }}>{description}</p>}
      </div>
      {actionText && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
}
