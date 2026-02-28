import {
    adaptProjectDetail,
    adaptBuildsList,
    adaptEvidenceSummary,
    ProjectDetailView,
    BuildRowView,
    EvidenceSummaryView
} from './adapters';

/**
 * 模拟从 B 端或聚合微服务拿取项目主视图数据
 */
export async function getProjectDetail(projectId: string): Promise<ProjectDetailView> {
    // 这里未来接入真正的 fetch('/api/projects/${projectId}')
    // 暂时用 Promise 配合 Mock 模拟真实 IO 延迟与装配

    // TODO: Connect to true backend Project API
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockRawData = {
                id: projectId,
                name: '[Super Caterpillar] Universe ' + projectId,
                organizationId: 'org-caterpillar-zero',
                status: 'RUNNING',
                createdAt: new Date(Date.now() - 86400000).toISOString(),
                updatedAt: new Date().toISOString(),
                stats: {
                    buildsCount: 3,
                    structuralStatus: 'Audited',
                    usage: '128.5 hrs',
                },
                audit: {
                    fingerprintStatus: 'SEALED',
                    rulesVersion: 'v2.1-INDUSTRIAL',
                }
            };

            resolve(adaptProjectDetail(mockRawData));
        }, 500);
    });
}

/**
 * 获取具体项目的构建实例列表
 */
export async function getProjectBuilds(projectId: string): Promise<BuildRowView[]> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockRawList = [
                {
                    id: 'build-v1.0.0',
                    name: 'Act 1: Genesis (Beta)',
                    status: 'DONE',
                    createdAt: new Date(Date.now() - 3600000).toISOString(),
                    metrics: { episodes: 1, scenes: 12, shots: 86 }
                },
                {
                    id: 'build-v0.9.5',
                    name: 'Act 1: Skeleton',
                    status: 'DONE',
                    createdAt: new Date(Date.now() - 7200000).toISOString(),
                    metrics: { episodes: 1, scenes: 12, shots: 0 }
                },
                {
                    id: 'build-v0.9.0',
                    name: 'Prototype Injection',
                    status: 'ERROR',
                    createdAt: new Date(Date.now() - 10800000).toISOString(),
                    metrics: { episodes: 0, scenes: 0, shots: 0 }
                }
            ];

            resolve(adaptBuildsList(mockRawList));
        }, 600);
    });
}

/**
 * 获取物理审计及取证报告大纲
 */
export async function getProjectEvidenceSummary(projectId: string): Promise<EvidenceSummaryView> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const mockRawData = {
                // missing globalHash intentionally
                // globalHash: 'sha256:8a1b9e...d74cf',
                cid: 'QmYwAPJzv5CZsnA625s3Xf2nex59n1X9',
                buildId: 'build-v1.0.0',
                verified: true,
                lastGeneratedAt: new Date().toISOString(),
                status: 'Verified',
            };

            const adapted = adaptEvidenceSummary(mockRawData);
            // Simulate that buildId was derived heuristically rather than from authoritative log
            if (adapted.buildId) {
                adapted.buildId.source = 'derived';
            }

            resolve(adapted);
        }, 400);
    });
}
