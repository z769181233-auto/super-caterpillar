'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';

export function FeatureGrid() {
    const t = useTranslations('Landing');

    const features = [
        { id: 1, icon: '🛡️', titleKey: 'feature1.title', descKey: 'feature1.desc' },
        { id: 2, icon: '⚙️', titleKey: 'feature2.title', descKey: 'feature2.desc' },
        { id: 3, icon: '⛓️', titleKey: 'feature3.title', descKey: 'feature3.desc' },
    ];

    return (
        <section
            style={{
                padding: '6rem 2rem',
                maxWidth: '1200px',
                margin: '0 auto',
                width: '100%',
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '2rem',
                }}
            >
                {features.map((f) => (
                    <Card key={f.id} hoverEffect style={{ padding: '2.5rem 2rem' }}>
                        <div
                            style={{
                                fontSize: '2.5rem',
                                marginBottom: '1.5rem',
                                background: 'var(--bg-root)',
                                width: '64px',
                                height: '64px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 'var(--r-md)',
                                border: '1px solid var(--border-subtle)'
                            }}
                        >
                            {f.icon}
                        </div>
                        <h3
                            style={{
                                fontSize: '1.25rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                marginBottom: '1rem',
                            }}
                        >
                            {t(f.titleKey as any)}
                        </h3>
                        <p
                            style={{
                                fontSize: '0.95rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.6,
                            }}
                        >
                            {t(f.descKey as any)}
                        </p>
                    </Card>
                ))}
            </div>
        </section>
    );
}
