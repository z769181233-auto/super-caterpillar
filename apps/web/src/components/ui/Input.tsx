import React, { InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, style, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={className}
        style={{
          width: '100%',
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-panel)',
          color: 'var(--text-primary)',
          border: '1px solid',
          borderColor: error ? 'var(--text-secondary)' : 'var(--border-subtle)', // Avoid red hardcode, use subtle text color as error border indicator beforehand
          outline: 'none',
          transition: 'all 0.2s ease',
          ...style,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--gold-weak)';
          e.target.style.boxShadow = '0 0 0 2px var(--gold-weak)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? 'var(--text-secondary)' : 'var(--border-subtle)';
          e.target.style.boxShadow = 'none';
        }}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
