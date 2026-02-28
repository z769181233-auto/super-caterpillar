import React, { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    hoverEffect?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className = '', hoverEffect = false, children, style, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={className}
                style={{
                    background: 'var(--bg-panel)',
                    borderRadius: 'var(--r-lg)',
                    border: '1px solid var(--border-subtle)',
                    padding: '1.5rem',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                    position: 'relative',
                    overflow: 'hidden',
                    ...style,
                }}
                onMouseOver={(e: React.MouseEvent<HTMLDivElement>) => {
                    if (!hoverEffect) return;
                    e.currentTarget.style.borderColor = 'var(--gold-weak)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                }}
                onMouseOut={(e: React.MouseEvent<HTMLDivElement>) => {
                    if (!hoverEffect) return;
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                }}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';
