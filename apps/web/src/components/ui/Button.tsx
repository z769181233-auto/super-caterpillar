import React, { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className = '',
            variant = 'primary',
            size = 'md',
            fullWidth = false,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        // Note: Styles are strictly using Token SSOT variables defined in TOKENS.md and globals.css

        // Base styles
        let baseStyles = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            borderRadius: 'var(--r-md)',
            fontWeight: 500,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            width: fullWidth ? '100%' : 'auto',
            border: '1px solid transparent',
            opacity: disabled ? 0.6 : 1,
            outline: 'none',
            fontFamily: 'inherit',
        };

        // Size variants
        const sizeStyles = {
            sm: { padding: '0.25rem 0.75rem', fontSize: '0.875rem' },
            md: { padding: '0.5rem 1rem', fontSize: '1rem' },
            lg: { padding: '0.75rem 1.5rem', fontSize: '1.125rem' },
        };

        // Color variants (Token Only)
        const variantStyles = {
            primary: {
                background: 'var(--gold)',
                color: 'var(--on-gold)', // Enforce SSOT token instead of hardcoded dark
                borderColor: 'var(--gold)',
            },
            secondary: {
                background: 'var(--bg-panel)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)',
            },
            ghost: {
                background: 'transparent',
                color: 'var(--text-secondary)',
                borderColor: 'transparent',
            },
            danger: {
                background: 'transparent',
                color: 'var(--hsl-error)', // Using the legacy exception token allowed in SSOT
                borderColor: 'hsla(var(--hsl-error), 0.3)',
            },
        };

        // Merge styles
        const mergedStyle = {
            ...baseStyles,
            ...sizeStyles[size],
            ...variantStyles[variant],
            ...props.style,
        };

        return (
            <button
                ref={ref}
                disabled={disabled}
                className={className}
                style={mergedStyle as React.CSSProperties}
                onMouseOver={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (disabled) return;
                    if (variant === 'primary') {
                        e.currentTarget.style.background = 'var(--gold-hover)';
                        e.currentTarget.style.borderColor = 'var(--gold-hover)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                    } else if (variant === 'secondary') {
                        e.currentTarget.style.borderColor = 'var(--gold-weak)';
                    } else if (variant === 'ghost') {
                        e.currentTarget.style.background = 'var(--bg-card)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                    } else if (variant === 'danger') {
                        e.currentTarget.style.background = 'hsla(var(--hsl-error), 0.1)';
                    }
                }}
                onMouseOut={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (disabled) return;
                    if (variant === 'primary') {
                        e.currentTarget.style.background = 'var(--gold)';
                        e.currentTarget.style.borderColor = 'var(--gold)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    } else if (variant === 'secondary') {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    } else if (variant === 'ghost') {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    } else if (variant === 'danger') {
                        e.currentTarget.style.background = 'transparent';
                    }
                }}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
