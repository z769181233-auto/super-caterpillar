import React, { HTMLAttributes } from 'react';

type StatusLevel = 'DEFAULT' | 'GOLD' | 'ERROR';

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
    level?: StatusLevel;
    dot?: boolean;
}

export function StatusPill({
    className = '',
    level = 'DEFAULT',
    dot = true,
    children,
    style,
    ...props
}: StatusPillProps) {
    let color = 'var(--text-muted)';
    let borderColor = 'var(--border-subtle)';
    let bgColor = 'var(--bg-card)';
    let dotColor = 'var(--text-muted)';

    if (level === 'GOLD') {
        color = 'var(--gold)';
        borderColor = 'var(--gold-weak)';
        bgColor = 'hsla(var(--gold-hsl, 42, 50%), 0.05)'; // Safe alpha layer over gold token if available
        dotColor = 'var(--gold)';
    } else if (level === 'ERROR') {
        color = 'var(--hsl-error)';
        borderColor = 'hsla(var(--hsl-error), 0.3)';
        bgColor = 'hsla(var(--hsl-error), 0.05)';
        dotColor = 'var(--hsl-error)';
    }

    return (
        <span
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--r-md)',
                fontSize: '0.75rem',
                fontWeight: 500,
                color: color,
                background: bgColor,
                border: `1px solid ${borderColor}`,
                ...style,
            }}
            {...props}
        >
            {dot && (
                <span
                    style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: dotColor,
                        boxShadow: level === 'GOLD' ? '0 0 4px var(--gold)' : 'none'
                    }}
                />
            )}
            {children}
        </span>
    );
}
