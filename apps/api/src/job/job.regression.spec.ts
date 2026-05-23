import { BadRequestException } from '@nestjs/common';
import { JobCreationOpsService } from './job-creation-ops.service';
import { JobUpdateOpsService } from './job-update-ops.service';

describe('job regressions', () => {
  const noop = {} as any;

  describe('JobCreationOpsService', () => {
    let service: JobCreationOpsService;

    beforeEach(() => {
      service = new JobCreationOpsService(
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop
      );
    });

    it('blocks SHOT_RENDER when analyzed scene content is missing', async () => {
      await expect(
        (service as any).validateShotRenderReadiness(
          {
            reviewStatus: 'APPROVED',
            scene: { enrichedText: '   ' },
          },
          false
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('skips readiness gate for verification jobs', async () => {
      await expect(
        (service as any).validateShotRenderReadiness(
          {
            reviewStatus: 'DRAFT',
            scene: { enrichedText: '' },
          },
          true
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('JobUpdateOpsService', () => {
    let service: JobUpdateOpsService;

    beforeEach(() => {
      service = new JobUpdateOpsService(noop, noop, noop, { emit: jest.fn() } as any);
    });

    it('normalizes pg fallback verification flag to camelCase', () => {
      const normalized = (service as any).normalizePgJob({
        id: 'job-1',
        is_verification: true,
      });

      expect(normalized.isVerification).toBe(true);
    });
  });
});
