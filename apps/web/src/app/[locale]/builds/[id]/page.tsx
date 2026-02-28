import { fetchBuildStudio } from "@/features/studio/api";
import BuildStudioClient from "./ui";

interface Props {
    params: {
        locale: string;
        id: string;
    };
}

export default async function ScriptBuildPage({ params }: Props) {
    const { id } = params;

    let data;
    try {
        data = await fetchBuildStudio(id);
    } catch (e: any) {
        console.error('Failed to fetch build studio data:', e);
        return (
            <div className="p-8 font-mono bg-red-50 text-red-900 border border-red-200 m-8 rounded">
                <h1 className="text-xl font-bold mb-4">Studio SSR Handshake Failed</h1>
                <p>Build ID: {id}</p>
                <pre className="mt-4 p-4 bg-red-900 text-red-100 rounded text-sm overflow-x-auto">
                    {e.message || String(e)}
                </pre>
            </div>
        );
    }

    return (
        <BuildStudioClient
            summary={data.summary}
            tree={data.tree}
            insights={data.insights}
        />
    );
}
