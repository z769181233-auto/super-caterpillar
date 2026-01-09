import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, className = '' }: SectionHeaderProps) {
  return (
    <div className={`text-center mb-16 ${className}`}>
      <h2 className="text-4xl md:text-5xl font-bold mb-4 whitespace-pre-wrap leading-tight text-white tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg md:text-xl text-muted-foreground whitespace-pre-wrap max-w-3xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  );
}
