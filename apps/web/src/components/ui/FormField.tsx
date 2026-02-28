import React, { ReactNode } from 'react';

interface FormFieldProps {
    label: string;
    children: ReactNode;
    helpText?: string | ReactNode;
    error?: string | ReactNode;
}

export function FormField({ label, children, helpText, error }: FormFieldProps) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', marginBottom: '1.5rem' }}>
            <label
                style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                }}
            >
                {label}
            </label>

            {children}

            {(helpText || error) && (
                <div
                    style={{
                        fontSize: '0.75rem',
                        // Reuse subtle mute token, don't invent independent explicit red warnings if not in tokens.
                        color: error ? 'var(--text-secondary)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        marginTop: '0.2rem'
                    }}
                >
                    {error && <span role="img" aria-label="error">⚠️</span>}
                    {error || helpText}
                </div>
            )}
        </div>
    );
}
