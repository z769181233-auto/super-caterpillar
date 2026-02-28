'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { useTranslations } from 'next-intl';

export function SystemStatusPanel() {
    const t = useTranslations('Projects.aside');

    // Hardcoded mock values per requirement, ready for real endpoints
    return (
        <Card style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('systemStatus')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Job Queue</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 600 }}>Healthy</span>
                </div>
                <div style={{ height: '1px', background: 'var(--line-separator)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Worker Fleet</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>3 Active</span>
                </div>
                <div style={{ height: '1px', background: 'var(--line-separator)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Storage & Audit</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--hsl-success)' }}>Synced</span>
                </div>
            </div>
        </Card>
    );
}
