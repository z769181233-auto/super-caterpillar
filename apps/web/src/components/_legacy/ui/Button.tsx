import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'glass';
    size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    className = '',
    children,
    ...props
}) => {
    // Base styles
    const baseStyles = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        fontWeight: 600,
        transition: 'all 0.3s var(--ease-spring)',
        cursor: 'pointer',
        gap: '0.5rem',
        border: 'none',
        outline: 'none',
    };

    // Variants
    const variants = {
        primary: {
            background: 'hsl(var(--hsl-primary))',
            color: '#fff',
            boxShadow: '0 0 10px hsla(var(--hsl-primary), 0.4)',
        },
        secondary: {
            background: 'hsl(var(--hsl-secondary))',
            color: '#fff',
            boxShadow: '0 0 10px hsla(var(--hsl-secondary), 0.4)',
        },
        ghost: {
            background: 'transparent',
            color: 'hsl(var(--hsl-text-main))',
            border: '1px solid currentColor',
        },
        glass: {
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--glass-border)',
            color: 'hsl(var(--hsl-text-main))',
        }
    };

    // Sizes
    const sizes = {
        sm: { padding: '0.4rem 0.8rem', fontSize: '0.875rem' },
        md: { padding: '0.6rem 1.2rem', fontSize: '1rem' },
        lg: { padding: '0.8rem 1.6rem', fontSize: '1.125rem' },
    };

    const combinedStyles = {
        ...baseStyles,
        ...variants[variant],
        ...sizes[size],
    };

    // Hover effect logic is tricky with inline styles for pseudo-classes.
    // For a robust system, usually CSS modules or Tailwind is preferred.
    // Here we use a unique class or style tag injection, OR keep it simple.
    // To enable hover, let's use a class approach by injecting a style tag if needed, 
    // OR just rely on globals.css utility classes if we had defined them.
    // BUT since we are doing Vanilla CSS + inline hybrid (for now), let's stick to inline.
    // Limitation: Hover states in inline styles need onMouseEnter/Leave.
    // BETTER: Use a className and define it in a module CSS or globals.

    // Strategy: Return a button with a predictable class 'btn-{variant}' and define those in globals.css NEXT time.
    // For now, let's just create the file and I will append the btn styles to globals.css in next step for cleaner code.

    return (
        <button
            className={`btn btn-${variant} btn-${size} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
