'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { projectApi } from '@/lib/apiClient';

type ReviewDecision = {
  auditId: string;
  createdAt: string;
  updatedAt?: string;
  decision: string;
  effectiveDecision: string;
  publishEligibility?: string;
  reviewRequired?: boolean;
  policyStage?: string;
  reviewPolicyResult?: string;
  reviewPolicySource?: string;
  semanticLocationSlug?: string | null;
  semanticTimeOfDay?: string | null;
  semanticConflictSummary?: string | null;
  semanticCharacters?: unknown[];
  memoryContextSource?: string | null;
  crossChapterMemoryHit?: boolean;
  approvalActionSource?: string | null;
  approvalActorUserId?: string | null;
  approvalReviewStatus?: string | null;
  approvalReviewNote?: string | null;
  approvalReviewedAt?: string | null;
};

type ReviewStatusFilter = 'PENDING' | 'DONE';

const DecisionBadge = ({ decision }: { decision: string }) => {
    let style: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500 };
    if (decision === 'ALLOW') style = { ...style, backgroundColor: '#dcfce7', color: '#166534' };
    else if (decision === 'BLOCK') style = { ...style, backgroundColor: '#fee2e2', color: '#991b1b' };
    else style = { ...style, backgroundColor: '#f3f4f6', color: '#374151' };
    return <span style={style}>{decision}</span>;
};

const renderText = (value: unknown, fallback = '-') =>
    typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const formatCharacters = (characters: unknown[] | undefined) => {
    if (!Array.isArray(characters) || characters.length === 0) return '-';
    return characters
        .map((character) => {
            if (typeof character === 'string') return character;
            if (character && typeof character === 'object' && 'name' in character) {
                return String((character as { name?: unknown }).name ?? '');
            }
            return '';
        })
        .filter(Boolean)
        .join(', ') || '-';
};

export function ReviewQueuePageContent() {
    const { projectId } = useParams() as { projectId: string };
    const [loading, setLoading] = useState(false);
    const [decisions, setDecisions] = useState<ReviewDecision[]>([]);
    const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('PENDING');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await projectApi.getQualityReviewQueue({ projectId, status: statusFilter, limit: 50 });
            setDecisions(Array.isArray(data) ? (data as ReviewDecision[]) : []);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '加载审核队列失败';
            alert(message);
        } finally { setLoading(false); }
    }, [projectId, statusFilter]);

    useEffect(() => {
        if (projectId) {
            void fetchData();
        }
    }, [fetchData, projectId]);

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', backgroundColor: '#020617', minHeight: '100vh', color: '#fff' }}>
            <div style={{ border: '1px solid #1f2937', borderRadius: '8px', backgroundColor: '#0b1120' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between' }}>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Quality Review Queue</h1>
                    <select value={statusFilter} disabled={loading} onChange={(e) => setStatusFilter(e.target.value as ReviewStatusFilter)} style={{ padding: '0.4rem', borderRadius: '4px', backgroundColor: '#020617', color: '#fff' }}>
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
                                <th style={{ padding: '0.75rem' }}>Eligibility</th>
                                <th style={{ padding: '0.75rem' }}>Scene Evidence</th>
                                <th style={{ padding: '0.75rem' }}>Policy / Approval Evidence</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && decisions.length === 0 ? (
                                <tr>
                                    <td style={{ padding: '0.75rem' }} colSpan={6}>Loading...</td>
                                </tr>
                            ) : null}
                            {!loading && decisions.length === 0 ? (
                                <tr>
                                    <td style={{ padding: '0.75rem', color: '#94a3b8' }} colSpan={6}>
                                        No review evidence found for this filter.
                                    </td>
                                </tr>
                            ) : null}
                            {decisions.map((item) => (
                                <tr key={item.auditId} style={{ borderBottom: '1px solid #1f2937' }}>
                                    <td style={{ padding: '0.75rem' }}>{new Date(item.createdAt).toLocaleString()}</td>
                                    <td style={{ padding: '0.75rem' }}><DecisionBadge decision={item.decision} /></td>
                                    <td style={{ padding: '0.75rem' }}>{item.effectiveDecision}</td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <div>{renderText(item.publishEligibility)}</div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                            {item.reviewRequired ? 'Review required' : 'No review required'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem', maxWidth: '260px' }}>
                                        <div>Location: {renderText(item.semanticLocationSlug)}</div>
                                        <div>Time: {renderText(item.semanticTimeOfDay)}</div>
                                        <div>Characters: {formatCharacters(item.semanticCharacters)}</div>
                                        <div style={{ color: '#94a3b8' }}>
                                            Conflict: {renderText(item.semanticConflictSummary)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem', maxWidth: '280px' }}>
                                        <div>Stage: {renderText(item.policyStage)}</div>
                                        <div>Result: {renderText(item.reviewPolicyResult)}</div>
                                        <div>Source: {renderText(item.reviewPolicySource)}</div>
                                        <div style={{ color: '#94a3b8' }}>
                                            Approval: {renderText(item.approvalReviewStatus)}
                                            {item.approvalReviewNote ? ` / ${item.approvalReviewNote}` : ''}
                                        </div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                            Memory: {renderText(item.memoryContextSource)}
                                            {item.crossChapterMemoryHit ? ' / cross-chapter hit' : ''}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
