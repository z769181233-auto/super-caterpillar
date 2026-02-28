import React, { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'outline' | 'filled';
}

export function Badge({ className = '', variant = 'outline', children, style, ...props }: BadgeProps) {
    const isOutline = variant === 'outline';

    return (
        <span
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--r-full)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: isOutline ? 'transparent' : 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: `1px solid ${isOutline ? 'var(--border-subtle)' : 'transparent'}`,
                ...style,
            }}
            {...props}
        >
            {children}
        </span>
    );
}
