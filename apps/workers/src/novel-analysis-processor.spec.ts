/// <reference types="jest" />
import { mapCE06OutputToProjectStructure } from './novel-analysis-processor';
import { CE06Output } from '@scu/engines-ce06';

describe('novel-analysis-processor', () => {
  describe('mapCE06OutputToProjectStructure', () => {
    it('should correctly map flat ScanChunk[] to hierarchy', () => {
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

      expect(result.seasons.length).toBe(1);
      expect(result.seasons[0].index).toBe(1);
      expect(result.seasons[0].title).toBe('Volume 1');
      expect(result.seasons[0].episodes.length).toBe(2);
      expect(result.seasons[0].episodes[0].title).toBe('Chapter 1');
      expect(result.seasons[0].episodes[1].title).toBe('Chapter 2');
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
      expect(result.seasons.length).toBe(1);
      expect(result.seasons[0].title).toContain('Legacy Volume');
      expect(result.seasons[0].episodes.length).toBe(1);
      expect(result.seasons[0].episodes[0].title).toContain('Legacy Chapter');
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
        volumes: [{ volume_index: 1, volume_title: 'Ignored Volume' }],
      };
      const result = mapCE06OutputToProjectStructure('test-proj', v11Output as CE06Output);
      expect(result.seasons.length).toBe(1);
      expect(result.seasons[0].title).toBe('V1.1 Season');
    });
  });
});
