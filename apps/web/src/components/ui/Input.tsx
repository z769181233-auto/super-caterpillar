import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      {label && (
        <label
          style={{
            fontSize: '0.875rem',
            color: 'hsl(var(--hsl-text-muted))',
            fontWeight: 500,
          }}
        >
          {label}
        </label>
      )}
      <input
        className={`glass-input ${className}`}
        style={{
          padding: '0.8rem 1rem',
          borderRadius: 'var(--radius-md)',
          background: 'hsla(var(--hsl-bg-surface), 0.5)',
          border: '1px solid var(--glass-border)',
          color: 'hsl(var(--hsl-text-main))',
          fontSize: '1rem',
          outline: 'none',
          transition: 'all 0.2s ease',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'hsl(var(--hsl-primary))';
          e.currentTarget.style.boxShadow = '0 0 0 2px hsla(var(--hsl-primary), 0.2)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--glass-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...props}
      />
    </div>
  );
};
