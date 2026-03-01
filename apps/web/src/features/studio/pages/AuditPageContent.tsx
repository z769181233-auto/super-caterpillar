'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export function AuditPageContent() {
    const { novelSourceId } = useParams() as { novelSourceId: string };
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!novelSourceId) return;
        fetch(`/api/audit/novel/${novelSourceId}/full`).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        }).then(json => {
            setData(json);
            setLoading(false);
        }).catch(err => {
            setError(err.message);
            setLoading(false);
        });
    }, [novelSourceId]);

    if (loading) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Loading...</div>;
    if (error) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center text-red-400">{error}</div>;

    return (
        <div className="p-8 bg-[#0a0a0c] min-h-screen text-white">
            <h1 className="text-4xl font-extrabold mb-8">Audit: {novelSourceId}</h1>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>
            </div>
        </div>
    );
}
