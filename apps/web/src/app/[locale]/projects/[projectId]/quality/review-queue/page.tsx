'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { projectApi } from '@/lib/apiClient';

// Feature Flag defaults
const FEATURE_V0_ENABLED = process.env.NEXT_PUBLIC_ENGINE_HUB_V0_ENABLED === '1';
const FEATURE_RERUN_ENABLED = process.env.NEXT_PUBLIC_QUALITY_POLICY_MANUAL_RERUN_ENABLED === '1';

const ReviewQueuePage = () => {
    const { projectId } = useParams() as { projectId: string };

    const [loading, setLoading] = useState(false);
    const [decisions, setDecisions] = useState<any[]>([]);
    const [statusFilter, setStatusFilter] = useState<'PENDING' | 'DONE'>('PENDING');

    // Track Rerun Request state
    const [rerunLoading, setRerunLoading] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await projectApi.getQualityReviewQueue({
                projectId,
                status: statusFilter,
                limit: 50
            });
            setDecisions(data || []);
        } catch (err: any) {
            alert(`Error fetching review queue: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            fetchData();
        }
    }, [projectId, statusFilter]);

    const handleRerun = async (auditId: string) => {
        if (!FEATURE_V0_ENABLED || !FEATURE_RERUN_ENABLED) {
            alert('Feature Disabled: Manual Rerun is not enabled.');
            return;
        }

        setRerunLoading(auditId);
        try {
            const res = await projectApi.manualRerunQualityDecision(auditId, 'Manual rerun via Review Queue');
            if (res.status === 'IDEMPOTENT') {
                alert('Already Requested: A rerun is already pending or completed.');
            } else {
                alert(`Rerun Started. Job ID: ${res.rerunJobId}`);
            }
            fetchData();
        } catch (err: any) {
            alert(`Rerun Failed: ${err.message}`);
        } finally {
            setRerunLoading(null);
        }
    };

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    padding: '1rem',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>Quality Review Queue</h1>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        >
                            <option value="PENDING">Pending Action</option>
                            <option value="DONE">Done / Handled</option>
                        </select>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '4px',
                                border: '1px solid #ccc',
                                backgroundColor: '#f9f9f9',
                                cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                <div style={{ padding: '1rem' }}>
                    {!FEATURE_RERUN_ENABLED && (
                        <div style={{
                            marginBottom: '1rem',
                            padding: '0.75rem',
                            backgroundColor: '#fffbeb',
                            color: '#92400e',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            border: '1px solid #fef3c7'
                        }}>
                            ⚠️ Manual Rerun Feature Flag is DISABLED.
                        </div>
                    )}

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                    <th style={{ padding: '0.75rem' }}>Created At</th>
                                    <th style={{ padding: '0.75rem' }}>Decision</th>
                                    <th style={{ padding: '0.75rem' }}>Effective</th>
                                    <th style={{ padding: '0.75rem' }}>Handled By</th>
                                    <th style={{ padding: '0.75rem' }}>Context</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {decisions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                                            {loading ? 'Loading...' : 'No decisions found via current filter.'}
                                        </td>
                                    </tr>
                                ) : (
                                    decisions.map((item) => {
                                        const canRerun =
                                            item.effectiveDecision === 'ALLOW' &&
                                            FEATURE_RERUN_ENABLED &&
                                            FEATURE_V0_ENABLED &&
                                            !item.handledBy;

                                        return (
                                            <tr key={item.auditId} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>
                                                    {new Date(item.createdAt).toLocaleString()}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <DecisionBadge decision={item.decision} />
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {item.effectiveDecision !== item.decision ? (
                                                        <span style={{ fontWeight: 'bold', color: '#059669' }}>
                                                            ALLOW (Override)
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#999' }}>-</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {item.handledBy ? (
                                                        <span style={{
                                                            padding: '0.1rem 0.4rem',
                                                            border: '1px solid #ddd',
                                                            borderRadius: '4px',
                                                            backgroundColor: '#f3f4f6'
                                                        }}>
                                                            {item.handledBy}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td style={{ padding: '0.75rem', color: '#666' }}>
                                                    <div style={{ whiteSpace: 'nowrap' }}>Scene: {item.sceneId || 'N/A'}</div>
                                                    <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '150px' }} title={item.traceId}>
                                                        Trace: {item.traceId}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                    <button
                                                        disabled={!canRerun || rerunLoading === item.auditId}
                                                        onClick={() => handleRerun(item.auditId)}
                                                        style={{
                                                            padding: '0.3rem 0.6rem',
                                                            borderRadius: '4px',
                                                            border: '1px solid #ccc',
                                                            backgroundColor: canRerun ? '#f3f4f6' : '#eee',
                                                            cursor: canRerun ? 'pointer' : 'not-allowed',
                                                            color: canRerun ? '#000' : '#888'
                                                        }}
                                                    >
                                                        {rerunLoading === item.auditId ? '...' : 'Rerun CE04'}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DecisionBadge = ({ decision }: { decision: string }) => {
    let style: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.125rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 500
    };

    if (decision === 'ALLOW') {
        style = { ...style, backgroundColor: '#dcfce7', color: '#166534' };
    } else if (decision === 'BLOCK') {
        style = { ...style, backgroundColor: '#fee2e2', color: '#991b1b' };
    } else if (decision === 'RETRY') {
        style = { ...style, backgroundColor: '#fef3c7', color: '#92400e' };
    } else {
        style = { ...style, backgroundColor: '#f3f4f6', color: '#374151' };
    }

    return <span style={style}>{decision}</span>;
};

export default ReviewQueuePage;
