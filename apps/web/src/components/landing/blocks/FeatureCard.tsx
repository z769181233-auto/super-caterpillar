import React from 'react';

interface FeatureCardProps {
  title: string;
  desc: string;
  icon?: string | React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  link?: string;
}

import Link from 'next/link';

export function FeatureCard({
  title,
  desc,
  icon,
  className = '',
  children,
  link,
}: FeatureCardProps) {
  const CardContent = (
    <div
      className={`
      relative overflow-hidden
      bg-gradient-to-br from-[hsla(var(--hsl-bg-surface),0.8)] to-[hsla(var(--hsl-bg-deep),0.9)]
      border border-[var(--glass-border)]
      rounded-[var(--radius-lg)]
      p-8 text-left transition-transform duration-300 hover:-translate-y-1
      ${className}
    `}
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[hsla(var(--hsl-brand),0.3)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {icon && (
        <div className="text-4xl mb-6 opacity-90 transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
      )}

      <h3 className="text-xl md:text-2xl font-bold mb-3 text-white">{title}</h3>
      <p className="text-normal text-muted-foreground leading-relaxed line-clamp-3">{desc}</p>
      {children}
    </div>
  );

  if (link) {
    return (
      <Link href={`/projects?module=${link}`} className="block">
        {CardContent}
      </Link>
    );
  }

  return CardContent;
}
