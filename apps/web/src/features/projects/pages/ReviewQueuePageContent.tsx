'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { projectApi } from '@/lib/apiClient';

const FEATURE_V0_ENABLED = process.env.NEXT_PUBLIC_ENGINE_HUB_V0_ENABLED === '1';
const FEATURE_RERUN_ENABLED = process.env.NEXT_PUBLIC_QUALITY_POLICY_MANUAL_RERUN_ENABLED === '1';

const DecisionBadge = ({ decision }: { decision: string }) => {
    let style: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500 };
    if (decision === 'ALLOW') style = { ...style, backgroundColor: '#dcfce7', color: '#166534' };
    else if (decision === 'BLOCK') style = { ...style, backgroundColor: '#fee2e2', color: '#991b1b' };
    else style = { ...style, backgroundColor: '#f3f4f6', color: '#374151' };
    return <span style={style}>{decision}</span>;
};

export function ReviewQueuePageContent() {
    const { projectId } = useParams() as { projectId: string };
    const [loading, setLoading] = useState(false);
    const [decisions, setDecisions] = useState<any[]>([]);
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'DONE'>('PENDING');

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await projectApi.getQualityReviewQueue({ projectId, status: statusFilter, limit: 50 });
            setDecisions(data || []);
        } catch (err: any) { alert(err.message); } finally { setLoading(false); }
    };

    useEffect(() => { if (projectId) fetchData(); }, [projectId, statusFilter]);

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', backgroundColor: '#020617', minHeight: '100vh', color: '#fff' }}>
            <div style={{ border: '1px solid #1f2937', borderRadius: '8px', backgroundColor: '#0b1120' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between' }}>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Quality Review Queue</h1>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ padding: '0.4rem', borderRadius: '4px', backgroundColor: '#020617', color: '#fff' }}>
                        <option value="PENDING">Pending Action</option>
                        <option value="DONE">Done / Handled</option>
                    </select>
                </div>
                <div style={{ padding: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #1f2937', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem' }}>Created At</th>
                                <th style={{ padding: '0.75rem' }}>Decision</th>
                                <th style={{ padding: '0.75rem' }}>Effective</th>
                            </tr>
                        </thead>
                        <tbody>
                            {decisions.map((item) => (
                                <tr key={item.auditId} style={{ borderBottom: '1px solid #1f2937' }}>
                                    <td style={{ padding: '0.75rem' }}>{new Date(item.createdAt).toLocaleString()}</td>
                                    <td style={{ padding: '0.75rem' }}><DecisionBadge decision={item.decision} /></td>
                                    <td style={{ padding: '0.75rem' }}>{item.effectiveDecision}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
