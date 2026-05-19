import { PrismaClient } from 'database';

type JsonRecord = Record<string, unknown>;

export interface StudioReceiptDryRunRecord {
  id: string;
  metadata?: unknown;
  asset?: {
    createdByJobId?: string | null;
    job?: {
      id?: string | null;
      traceId?: string | null;
      createdAt?: Date | string | null;
      type?: string | null;
      status?: string | null;
    } | null;
  } | null;
}

export interface StudioReceiptDryRunSummary {
  smoke: 'studio-receipt-dry-run';
  dryRun: true;
  status: 'OK' | 'WARN' | 'SKIPPED';
  projectId: string | null;
  projectName: string | null;
  inspectedPublishedVideos: number;
  samplesWithJobTrace: number;
  samplesWithDirectorLayer: number;
  samplesWithReviewEvidence: number;
  samplesWithApprovalEvidence: number;
  memoryAwareSamples: number;
  crossChapterAwareSamples: number;
  warnings: string[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function directorLayerOf(metadata: unknown): JsonRecord {
  if (!isRecord(metadata)) {
    return {};
  }

  const directorLayer = metadata.directorLayer;
  return isRecord(directorLayer) ? directorLayer : {};
}

function hasAnyString(record: JsonRecord, keys: string[]): boolean {
  return keys.some((key) => Boolean(stringValue(record[key])));
}

export function summarizeStudioReceiptDryRun(
  records: StudioReceiptDryRunRecord[],
  project?: { id: string; name: string } | null
): StudioReceiptDryRunSummary {
  const warnings: string[] = [];

  if (!project) {
    warnings.push('No reusable Smoke Publish/Smoke Timeline project was found. Dry-run skipped without provisioning data.');
  }

  const samplesWithJobTrace = records.filter((record) => Boolean(record.asset?.job?.traceId)).length;
  const samplesWithDirectorLayer = records.filter((record) => Object.keys(directorLayerOf(record.metadata)).length > 0).length;
  const samplesWithReviewEvidence = records.filter((record) => {
    const directorLayer = directorLayerOf(record.metadata);
    return hasAnyString(directorLayer, ['reviewPolicyResult', 'reviewPolicySource', 'publishEligibility']);
  }).length;
  const samplesWithApprovalEvidence = records.filter((record) => {
    const directorLayer = directorLayerOf(record.metadata);
    return hasAnyString(directorLayer, ['approvalActionSource', 'approvalReviewStatus', 'publishAction']);
  }).length;
  const memoryAwareSamples = records.filter((record) => {
    const directorLayer = directorLayerOf(record.metadata);
    return Boolean(stringValue(directorLayer.memoryContextSource));
  }).length;
  const crossChapterAwareSamples = records.filter((record) => {
    const directorLayer = directorLayerOf(record.metadata);
    return Boolean(directorLayer.crossChapterMemoryHit);
  }).length;

  if (project && records.length === 0) {
    warnings.push('Reusable project was found, but it has no published videos to inspect.');
  }
  if (records.length > 0 && samplesWithDirectorLayer === 0) {
    warnings.push('Published videos exist, but no directorLayer receipt metadata was found.');
  }
  if (records.length > 0 && samplesWithReviewEvidence === 0) {
    warnings.push('Published videos exist, but no review-policy receipt evidence was found.');
  }

  const status: StudioReceiptDryRunSummary['status'] = !project ? 'SKIPPED' : warnings.length > 0 ? 'WARN' : 'OK';

  return {
    smoke: 'studio-receipt-dry-run',
    dryRun: true,
    status,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    inspectedPublishedVideos: records.length,
    samplesWithJobTrace,
    samplesWithDirectorLayer,
    samplesWithReviewEvidence,
    samplesWithApprovalEvidence,
    memoryAwareSamples,
    crossChapterAwareSamples,
    warnings,
  };
}

export function sampleStudioReceiptRecords(): StudioReceiptDryRunRecord[] {
  return [
    {
      id: 'published-video-1',
      metadata: {
        directorLayer: {
          publishAction: 'PUBLISH',
          publishEligibility: 'ELIGIBLE',
          reviewPolicyResult: 'PASS',
          reviewPolicySource: 'review-policy-trace',
          approvalActionSource: 'studio-approval',
          approvalReviewStatus: 'APPROVED',
          memoryContextSource: 'cross-chapter-memory',
          crossChapterMemoryHit: true,
        },
      },
      asset: {
        createdByJobId: 'job-1',
        job: {
          id: 'job-1',
          traceId: 'trace-1',
          createdAt: '2026-05-19T00:00:00.000Z',
          type: 'VIDEO',
          status: 'COMPLETED',
        },
      },
    },
  ];
}

async function loadReusableProject(prisma: PrismaClient): Promise<{ id: string; name: string } | null> {
  return prisma.project.findFirst({
    where: {
      OR: [{ name: { startsWith: 'Smoke Publish ' } }, { name: { startsWith: 'Smoke Timeline ' } }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  });
}

async function loadPublishedVideoRecords(prisma: PrismaClient, projectId: string): Promise<StudioReceiptDryRunRecord[]> {
  return prisma.publishedVideo.findMany({
    where: { projectId },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: 20,
    select: {
      id: true,
      metadata: true,
      asset: {
        select: {
          createdByJobId: true,
          job: {
            select: {
              id: true,
              traceId: true,
              createdAt: true,
              type: true,
              status: true,
            },
          },
        },
      },
    },
  });
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: pnpm --filter api smoke:studio-receipt:dry-run [--sample]',
      '',
      'Read-only dry-run smoke script.',
      'It inspects existing Smoke Publish/Smoke Timeline published-video receipt evidence.',
      'It never provisions data, starts services, runs workers, or generates images/videos.',
    ].join('\n') + '\n'
  );
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  if (argv.includes('--sample')) {
    printJson(
      summarizeStudioReceiptDryRun(sampleStudioReceiptRecords(), {
        id: 'sample-project',
        name: 'Smoke Publish Sample',
      })
    );
    return;
  }

  const prisma = new PrismaClient();

  try {
    const project = await loadReusableProject(prisma);
    const records = project ? await loadPublishedVideoRecords(prisma, project.id) : [];

    printJson(summarizeStudioReceiptDryRun(records, project));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
