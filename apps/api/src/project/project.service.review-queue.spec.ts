import { ProjectService } from './project.service';

describe('ProjectService publish review queue wiring', () => {
  it('maps published video director layer into review queue items', async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'project-1',
          organizationId: 'org-1',
        }),
      },
      publishedVideo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'publish-1',
            createdAt: new Date('2026-04-02T10:00:00.000Z'),
            updatedAt: new Date('2026-04-02T10:05:00.000Z'),
            status: 'INTERNAL_READY',
            metadata: {
              directorLayer: {
                publishAction: 'REQUIRE_REVIEW',
                publishEligibility: 'REVIEWABLE',
                reviewRequired: true,
                policyStage: 'REVIEW_GATE',
                reviewPolicyResult: 'require_review',
                semanticLocationSlug: '旧码头',
                semanticTimeOfDay: '清晨',
                semanticConflictSummary: '陈河拦住她，质问她为什么还要隐瞒真相。',
                memoryContextSource: 'semantic-memory-stack-v1',
                crossChapterMemoryHit: false,
              },
            },
            asset: {
              id: 'asset-1',
              ownerType: 'SCENE',
              ownerId: 'scene-1',
              shot: null,
            },
          },
        ]),
      },
      publishingReview: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const service = new ProjectService(prisma, {} as any, {} as any, {} as any);

    const queue = await service.listQualityReviewQueue('project-1', 'org-1', {
      status: 'PENDING',
      limit: 50,
    });

    expect(queue).toEqual([
      expect.objectContaining({
        auditId: 'publish-1',
        sceneId: 'scene-1',
        decision: 'REQUIRE_REVIEW',
        effectiveDecision: 'review_required',
        publishEligibility: 'REVIEWABLE',
        reviewRequired: true,
        reviewPolicySource: 'director-layer',
        policyStage: 'REVIEW_GATE',
        semanticLocationSlug: '旧码头',
        memoryContextSource: 'semantic-memory-stack-v1',
      }),
    ]);
  });

  it('prefers publishing review result when a final review decision exists', async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'project-1',
          organizationId: 'org-1',
        }),
      },
      publishedVideo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'publish-2',
            createdAt: new Date('2026-04-02T10:00:00.000Z'),
            updatedAt: new Date('2026-04-02T10:05:00.000Z'),
            status: 'INTERNAL_READY',
            metadata: {
              directorLayer: {
                publishAction: 'REQUIRE_REVIEW',
                publishEligibility: 'REVIEWABLE',
                reviewRequired: true,
              },
            },
            asset: {
              id: 'asset-2',
              ownerType: 'SHOT',
              ownerId: 'shot-2',
              shot: {
                id: 'shot-2',
                sceneId: 'scene-2',
              },
            },
          },
        ]),
      },
      publishingReview: {
        findMany: jest.fn().mockResolvedValue([
          {
            shotId: 'shot-2',
            result: 'pass',
          },
        ]),
      },
    } as any;

    const service = new ProjectService(prisma, {} as any, {} as any, {} as any);

    const queue = await service.listQualityReviewQueue('project-1', 'org-1', {
      limit: 50,
    });

    expect(queue).toEqual([
      expect.objectContaining({
        auditId: 'publish-2',
        sceneId: 'scene-2',
        decision: 'ALLOW_PUBLISH',
        effectiveDecision: 'publishable',
        publishEligibility: 'ELIGIBLE',
        reviewRequired: false,
        reviewPolicyResult: 'pass',
        reviewPolicySource: 'publishing-review',
      }),
    ]);
  });

  it('normalizes incomplete director-layer evidence into stable empty strings for queue consumers', async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'project-1',
          organizationId: 'org-1',
        }),
      },
      publishedVideo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'publish-incomplete-1',
            createdAt: new Date('2026-04-02T10:00:00.000Z'),
            updatedAt: new Date('2026-04-02T10:05:00.000Z'),
            status: 'INTERNAL_READY',
            metadata: {
              directorLayer: {
                semanticLocationSlug: '废弃锅炉房外的检修通道尽头',
                semanticTimeOfDay: '夜晚',
                memoryContextSource: 'semantic-memory-stack-v1',
                crossChapterMemoryHit: true,
              },
            },
            asset: {
              id: 'asset-incomplete-1',
              ownerType: 'SCENE',
              ownerId: 'scene-incomplete-1',
              shot: null,
            },
          },
        ]),
      },
      publishingReview: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const service = new ProjectService(prisma, {} as any, {} as any, {} as any);

    const queue = await service.listQualityReviewQueue('project-1', 'org-1', {
      limit: 50,
    });

    expect(queue).toEqual([
      expect.objectContaining({
        auditId: 'publish-incomplete-1',
        sceneId: 'scene-incomplete-1',
        decision: 'UNKNOWN',
        effectiveDecision: 'pending',
        publishEligibility: 'UNKNOWN',
        reviewPolicyResult: '',
        policyStage: '',
        reviewPolicySource: 'derived-fallback',
        memoryContextSource: 'semantic-memory-stack-v1',
        crossChapterMemoryHit: true,
      }),
    ]);
  });

  it('surfaces approval action evidence for decision ux', async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'project-1',
          organizationId: 'org-1',
        }),
      },
      publishedVideo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'publish-3',
            createdAt: new Date('2026-04-02T10:00:00.000Z'),
            updatedAt: new Date('2026-04-02T10:05:00.000Z'),
            status: 'INTERNAL_READY',
            metadata: {
              directorLayer: {
                publishAction: 'REQUIRE_REVIEW',
                publishEligibility: 'REVIEWABLE',
                reviewRequired: true,
                policyStage: 'REVIEW_GATE',
                reviewPolicyResult: 'require_review',
                reviewPolicySource: 'publishing-review',
                approvalActionSource: 'approval-action',
                approvalActorUserId: 'user-1',
                approvalReviewStatus: 'REJECTED',
                approvalReviewNote: 'needs revision',
                approvalReviewedAt: '2026-04-02T11:00:00.000Z',
              },
            },
            asset: {
              id: 'asset-3',
              ownerType: 'SHOT',
              ownerId: 'shot-3',
              shot: {
                id: 'shot-3',
                sceneId: 'scene-3',
              },
            },
          },
        ]),
      },
      publishingReview: {
        findMany: jest.fn().mockResolvedValue([
          {
            shotId: 'shot-3',
            result: 'require_review',
          },
        ]),
      },
    } as any;

    const service = new ProjectService(prisma, {} as any, {} as any, {} as any);

    const queue = await service.listQualityReviewQueue('project-1', 'org-1', {
      limit: 50,
    });

    expect(queue).toEqual([
      expect.objectContaining({
        approvalActionSource: 'approval-action',
        approvalActorUserId: 'user-1',
        approvalReviewStatus: 'REJECTED',
        approvalReviewNote: 'needs revision',
        approvalReviewedAt: '2026-04-02T11:00:00.000Z',
      }),
    ]);
  });
});
