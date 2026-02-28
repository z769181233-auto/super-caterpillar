'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { StatusPill } from '@/components/ui/StatusPill';

export function ProofStrip() {
    const t = useTranslations('Landing');

    return (
        <section
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '2rem',
                padding: '2.5rem 2rem',
                borderTop: '1px solid var(--border-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-panel)',
                alignItems: 'center',
            }}
        >
            <StatusPill level="GOLD">{t('proof.audited')}</StatusPill>
            <StatusPill level="GOLD">{t('proof.sealed')}</StatusPill>
            <StatusPill level="DEFAULT">{t('proof.i18n')}</StatusPill>
            <StatusPill level="DEFAULT">{t('proof.ssot')}</StatusPill>
        </section>
    );
}
