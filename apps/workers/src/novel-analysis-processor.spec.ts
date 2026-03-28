/// <reference types="jest" />
import {
  applyAnalyzedStructureToDatabase,
  getPersistedSceneIndex,
  mapCE06OutputToProjectStructure,
} from './novel-analysis-processor';
import { CE06Output } from '@scu/engines-ce06';

describe('novel-analysis-processor', () => {
  describe('mapCE06OutputToProjectStructure', () => {
    it('returns an empty hierarchy for scan-only chunks without scene content', () => {
      const scanOutput: any = {
        volumes: [
          {
            volume_index: 1,
            volume_title: 'Volume 1',
            chapter_index: 1,
            chapter_title: 'Chapter 1',
            start_line: 0,
            end_line: 10,
          },
          {
            volume_index: 1,
            volume_title: 'Volume 1',
            chapter_index: 2,
            chapter_title: 'Chapter 2',
            start_line: 11,
            end_line: 20,
          },
        ],
      };

      const result = mapCE06OutputToProjectStructure('test-proj', scanOutput as CE06Output);

      expect(result.seasons).toEqual([]);
      expect(result.stats).toEqual({
        seasonsCount: 0,
        episodesCount: 0,
        scenesCount: 0,
        shotsCount: 0,
      });
    });

    it('should correctly map ALREADY structured volumes (idempotent/legacy)', () => {
      const legacyOutput: any = {
        volumes: [
          {
            title: 'Legacy Volume',
            chapters: [
              {
                title: 'Legacy Chapter',
                scenes: [{ title: 'Legacy Scene', content: 'Legacy Content' }],
              },
            ],
          },
        ],
      };
      const result = mapCE06OutputToProjectStructure('test-proj', legacyOutput as CE06Output);
      expect(result.seasons!.length).toBe(1);
      expect(result.seasons![0].title).toContain('Legacy Volume');
      expect(result.seasons![0].episodes.length).toBe(1);
      expect(result.seasons![0].episodes[0].title).toContain('Legacy Chapter');
    });

    it('should prioritize seasons if present (V1.1)', () => {
      const v11Output: any = {
        seasons: [
          {
            index: 1,
            title: 'V1.1 Season',
            episodes: [
              {
                index: 1,
                title: 'V1.1 Ep',
                scenes: [{ index: 1, title: 'V1.1 Sc', shots: [{ index: 1, text: 's' }] }],
              },
            ],
          },
        ],
        volumes: [{ volumeIndex: 1, volume_title: 'Ignored Volume' }],
      };
      const result = mapCE06OutputToProjectStructure('test-proj', v11Output as CE06Output);
      expect(result.seasons!.length).toBe(1);
      expect(result.seasons![0].title).toBe('V1.1 Season');
    });
  });

  describe('getPersistedSceneIndex', () => {
    it('prefers persisted sceneIndex from database rows', () => {
      expect(getPersistedSceneIndex({ sceneIndex: 3, index: 99 })).toBe(3);
    });

    it('falls back to analyzed structure index', () => {
      expect(getPersistedSceneIndex({ index: 4 })).toBe(4);
    });

    it('returns undefined for malformed scene-like inputs', () => {
      expect(getPersistedSceneIndex({})).toBeUndefined();
      expect(getPersistedSceneIndex(undefined)).toBeUndefined();
    });
  });

  describe('applyAnalyzedStructureToDatabase', () => {
    const structure = {
      projectId: 'project-1',
      seasons: [],
      episodes: [
        {
          index: 1,
          title: 'Episode 1',
          summary: '',
          scenes: [],
        },
      ],
      stats: {
        seasonsCount: 0,
        episodesCount: 1,
        scenesCount: 0,
        shotsCount: 0,
      },
    } as any;

    function createFlatModeTx() {
      return {
        novel: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        episode: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({
            id: 'ep-1',
            index: 1,
            name: 'Episode 1',
            summary: null,
          }),
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'ep-1',
              index: 1,
              name: 'Episode 1',
              summary: null,
              scenes: [],
            },
          ]),
        },
      };
    }

    it('uses prisma.$transaction when available on PrismaClient', async () => {
      const tx = createFlatModeTx();
      const prisma = {
        $transaction: jest.fn(async (runner: any) => runner(tx)),
      } as any;

      const result = await applyAnalyzedStructureToDatabase(prisma, structure);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.stats.created.episodes).toBe(1);
      expect(tx.episode.upsert).toHaveBeenCalledTimes(1);
    });

    it('falls back to direct execution when already given a transaction client', async () => {
      const tx = createFlatModeTx() as any;

      const result = await applyAnalyzedStructureToDatabase(tx, structure);

      expect(result.stats.created.episodes).toBe(1);
      expect(tx.episode.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
