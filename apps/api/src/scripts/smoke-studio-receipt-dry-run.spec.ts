import {
  sampleStudioReceiptRecords,
  summarizeStudioReceiptDryRun,
  type StudioReceiptDryRunRecord,
} from './smoke-studio-receipt-dry-run';

describe('smoke-studio-receipt-dry-run', () => {
  it('skips safely when no reusable smoke project exists', () => {
    const summary = summarizeStudioReceiptDryRun([]);

    expect(summary.status).toBe('SKIPPED');
    expect(summary.dryRun).toBe(true);
    expect(summary.projectId).toBeNull();
    expect(summary.inspectedPublishedVideos).toBe(0);
    expect(summary.warnings).toContain(
      'No reusable Smoke Publish/Smoke Timeline project was found. Dry-run skipped without provisioning data.'
    );
  });

  it('summarizes existing receipt evidence without requiring generation', () => {
    const summary = summarizeStudioReceiptDryRun(sampleStudioReceiptRecords(), {
      id: 'sample-project',
      name: 'Smoke Publish Sample',
    });

    expect(summary.status).toBe('OK');
    expect(summary.inspectedPublishedVideos).toBe(1);
    expect(summary.samplesWithJobTrace).toBe(1);
    expect(summary.samplesWithDirectorLayer).toBe(1);
    expect(summary.samplesWithReviewEvidence).toBe(1);
    expect(summary.samplesWithApprovalEvidence).toBe(1);
    expect(summary.memoryAwareSamples).toBe(1);
    expect(summary.crossChapterAwareSamples).toBe(1);
  });

  it('warns when published videos do not carry director-layer receipt metadata', () => {
    const records: StudioReceiptDryRunRecord[] = [
      {
        id: 'published-video-without-receipt',
        metadata: {},
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

    const summary = summarizeStudioReceiptDryRun(records, {
      id: 'project-1',
      name: 'Smoke Timeline Project',
    });

    expect(summary.status).toBe('WARN');
    expect(summary.samplesWithJobTrace).toBe(1);
    expect(summary.samplesWithDirectorLayer).toBe(0);
    expect(summary.samplesWithReviewEvidence).toBe(0);
    expect(summary.warnings).toContain('Published videos exist, but no directorLayer receipt metadata was found.');
    expect(summary.warnings).toContain('Published videos exist, but no review-policy receipt evidence was found.');
  });
});
