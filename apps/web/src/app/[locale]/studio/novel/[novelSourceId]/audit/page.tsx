
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function AuditPage() {
    const { novelSourceId } = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!novelSourceId) return;

        // Fetch data from our new API
        // Assuming backend is proxying or valid
        // In dev, usually /api is proxied or we use absolute URL
        // For specific gate environment, we might need env var.
        // Assuming standard /api proxy setup in Next.js or direct fetch.
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/audit/novels/${novelSourceId}/insight`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setData(json);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [novelSourceId]);

    if (loading) return <div className="p-8">Loading Audit Data...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!data) return <div className="p-8">No Data</div>;

    return (
        <div className="p-8 space-y-8 bg-gray-50 min-h-screen text-gray-800">
            <h1 className="text-2xl font-bold">Web Audit: Novel Insight</h1>
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>NovelSource ID:</strong> {data.novelSourceId}</div>
                <div><strong>Project ID:</strong> {data.projectId}</div>
            </div>

            <section className="bg-white p-6 rounded shadow">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">CE06: Novel Analysis (Structure)</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2">Job ID</th>
                                <th className="p-2">Worker ID</th>
                                <th className="p-2">Status</th>
                                <th className="p-2">Engine</th>
                                <th className="p-2">Created At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.ce06.map((item: any) => (
                                <tr key={item.jobId} className="border-t hover:bg-gray-50">
                                    <td className="p-2 font-mono text-xs">{item.jobId}</td>
                                    <td className="p-2 font-mono text-xs">{item.workerId}</td>
                                    <td className="p-2">
                                        <span className={`px-2 py-1 rounded text-xs ${item.status === 'SUCCEEDED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-2 text-xs">{item.engineKey} v{item.engineVersion}</td>
                                    <td className="p-2 text-xs">{new Date(item.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="bg-white p-6 rounded shadow">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">CE07: Memory Short Term (Context)</h2>
                <div className="space-y-4">
                    {data.ce07.map((item: any) => (
                        <div key={item.jobId} className="border rounded p-4">
                            <div className="flex justify-between items-center mb-2">
                                <div className="text-sm font-mono">{item.jobId}</div>
                                <div className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()} | Worker: {item.workerId}</div>
                            </div>
                            <div className="bg-gray-900 text-green-400 p-4 rounded text-xs font-mono overflow-auto max-h-64">
                                <pre>{JSON.stringify(item.memoryContent, null, 2)}</pre>
                            </div>
                            <div className="mt-2 text-right">
                                <a href={`/api/audit/jobs/${item.jobId}`} target="_blank" className="text-blue-600 hover:underline text-sm">
                                    View Full Job Audit JSON &rarr;
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
