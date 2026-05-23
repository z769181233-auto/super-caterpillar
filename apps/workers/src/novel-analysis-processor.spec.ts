/// <reference types="jest" />
import {
  applyAnalyzedStructureToDatabase,
  composeNovelChapterContent,
  enrichAnalyzedStructureSemantics,
  extractSceneSemantics,
  getNovelContentStream,
  getPersistedSceneIndex,
  mapCE06OutputToProjectStructure,
} from './novel-analysis-processor';
import { CE06Output } from '@scu/engines-ce06';
import {
  buildNovelAnalysisCoverageReport,
  buildChapterSemanticContext,
  buildSemanticMemoryContext,
  extractSceneSemanticsFromText,
} from '@scu/shared-types';
import { Readable } from 'stream';

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

  describe('composeNovelChapterContent', () => {
    it('prepends chapter title when raw content lacks structure markers', () => {
      expect(
        composeNovelChapterContent({
          title: '第1章：相遇',
          rawContent: '山路尽头，少年第一次看见那座小镇。',
        })
      ).toBe('第1章：相遇\n山路尽头，少年第一次看见那座小镇。');
    });

    it('avoids duplicating the chapter title when raw content already starts with it', () => {
      expect(
        composeNovelChapterContent({
          title: '第2章：入城',
          rawContent: '第2章：入城\n他带着紧张与期待，沿着青石板路往前走。',
        })
      ).toBe('第2章：入城\n他带着紧张与期待，沿着青石板路往前走。');
    });
  });

  describe('extractSceneSemantics', () => {
    it('builds chapter-level semantic context truth from richer chapter text', () => {
      const context = buildChapterSemanticContext(
        [
          '夜里，审讯室外的走廊里，林夏听见赵真在门内喊陈河的名字。',
          '',
          '她没有推门，只隔着玻璃说如果周沉今晚还不回来，所有人都会被拖下水。',
        ].join('\n')
      );

      expect(context.characters).toEqual(expect.arrayContaining(['林夏', '赵真', '陈河', '周沉']));
      expect(context.dominantLocation).toBe('审讯室外的走廊');
      expect(context.dominantTimeOfDay).toBe('夜晚');
      expect(context.dominantConflictSummary).toContain('拖下水');
      expect(context.summary).toContain('章节角色：');
    });

    it('extracts characters, location, time, emotion, and conflict from scene text', () => {
      const semantics = extractSceneSemantics(
        '清晨，林夏来到旧码头。陈河拦住她，质问她为什么还要隐瞒真相。两人对峙，气氛紧张而愤怒。'
      );

      expect(semantics.characters).toEqual(['林夏', '陈河']);
      expect(semantics.location).toBe('旧码头');
      expect(semantics.timeOfDay).toBe('清晨');
      expect(semantics.emotionalTone).toBe('紧张');
      expect(semantics.conflictSummary).toContain('质问');
      expect(semantics.semanticSummary).toContain('角色：林夏、陈河');
    });

    it('uses chapter context truth as the primary semantic engine and keeps rules as fallback', () => {
      const chapterContext = buildChapterSemanticContext(
        [
          '傍晚，废弃锅炉房外的检修通道尽头，林夏贴着墙，没有让脚步声传出去。',
          '',
          '她听见周沉在里面说，赵真已经替陈河把记录改了。',
          '要是今晚再有人追问，就把账记在林夏头上。',
        ].join('\n')
      );

      const semantics = extractSceneSemanticsFromText('她没有立刻回头。要是今晚再有人追问，就把账记在林夏头上。', {
        chapterContext,
      });

      expect(semantics.location).toBe('废弃锅炉房外的检修通道尽头');
      expect(semantics.timeOfDay).toBe('傍晚');
      expect(semantics.conflictSummary).toContain('记在林夏头上');
      expect(semantics.chapterContextSummary).toContain('章节角色：');
      expect(semantics.semanticMethod).toBe('contextual-semantic-engine-v1');
      expect(semantics.fallbackStrategy).toBe('rule-based-fallback-v1');
    });

    it('uses memory context as a first-class semantic input before chapter fallback', () => {
      const memoryContext = buildSemanticMemoryContext({
        shortTermSummary: '上一章摘要：林夏在旧码头与陈河对峙，钥匙线索已经暴露。',
        longTermSummary: '档案室外的走廊尽头：赵真只说周沉已经把钥匙交给陈河。',
        entityStateSummary: '林夏位于审讯室外的走廊；陈河位于审讯室；赵真位于审讯室；周沉位于审讯室。',
        seededCharacters: ['林夏', '陈河', '赵真', '周沉'],
      });

      const semantics = extractSceneSemanticsFromText('如果今晚再有人追问，这件事还是会算到她头上。', {
        memoryContext,
      });

      expect(semantics.characters).toEqual(
        expect.arrayContaining(['林夏', '陈河', '赵真', '周沉'])
      );
      expect(semantics.location).toBe('审讯室');
      expect(semantics.conflictSummary).toContain('算到她头上');
      expect(semantics.memoryContextSummary).toContain('短期记忆：');
      expect(semantics.memoryContextSource).toBe('semantic-memory-stack-v1');
      expect(semantics.crossChapterMemoryHit).toBe(true);
    });

    it('extracts both characters and conflict from denser interaction text', () => {
      const semantics = extractSceneSemantics(
        '夜里，林夏在废弃仓库门口看着陈河，低声逼问他到底把钥匙藏到了哪里。陈河沉默不答，只一步步逼近她。'
      );

      expect(semantics.characters).toEqual(['林夏', '陈河']);
      expect(semantics.location).toBe('废弃仓库门口');
      expect(semantics.timeOfDay).toBe('夜晚');
      expect(semantics.conflictSummary).toContain('逼问');
      expect(semantics.semanticSummary).toContain('角色：林夏、陈河');
    });

    it('keeps key semantics for denser implicit-threat scenes', () => {
      const semantics = extractSceneSemantics(
        '雨夜的审讯室里，林夏没有回答。陈河把录音笔推到她面前，说如果她今晚再不开口，赵真就会先替她背锅。门外脚步声越来越近。'
      );

      expect(semantics.characters).toEqual(['林夏', '陈河', '赵真']);
      expect(semantics.location).toBe('审讯室');
      expect(semantics.timeOfDay).toBe('夜晚');
      expect(semantics.conflictSummary).toContain('背锅');
      expect(semantics.semanticSummary).toContain('角色：林夏、陈河、赵真');
    });

    it('generalizes across denser multi-character narrative scenes', () => {
      const semantics = extractSceneSemantics(
        '深夜，审讯室外的走廊里，林夏听见赵真在门内喊陈河的名字。她没有推门，只隔着玻璃说如果周沉今晚还不回来，所有人都会被拖下水。'
      );

      expect(semantics.characters).toEqual(['林夏', '赵真', '陈河', '周沉']);
      expect(semantics.location).toBe('审讯室外的走廊');
      expect(semantics.timeOfDay).toBe('夜晚');
      expect(semantics.conflictSummary).toContain('拖下水');
      expect(semantics.semanticSummary).toContain('角色：林夏、赵真、陈河、周沉');
    });

    it('extracts production coverage for the fixed 表姑娘 regression sample', () => {
      const sample = [
        '第一章 藏起律法书，只为等首辅回府',
        '',
        '仲春，静水院一片寂静。薛知盈已过及笄年纪，却仍被萧家用婚事拿捏。',
        '春桃抱着针线篮进门，低声说：“姑娘，王嬷嬷来了，夫人请你去云墨斋。”',
        '薛知盈抬头，看见萧昀祈立在窗外回廊下，手中仍握着那卷大周律疏。',
        '王嬷嬷推门进来，笑着劝她：“表姑娘，今日别再闹了。”',
        '萧昀祈没有进屋，只隔着窗说：“若她不愿，这门亲事谁也不能替她定。”',
      ].join('\n');

      const context = buildChapterSemanticContext(sample);
      const report = buildNovelAnalysisCoverageReport(sample);

      expect(context.characters).toEqual(
        expect.arrayContaining(['薛知盈', '萧昀祈', '春桃', '王嬷嬷'])
      );
      expect(report.extractedCharacters).toEqual(
        expect.arrayContaining(['薛知盈', '萧昀祈', '春桃', '王嬷嬷'])
      );
      expect(report.extractedLocations).toEqual(expect.arrayContaining(['静水院', '云墨斋']));
      expect(report.normalizedCharacters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ canonicalName: '薛知盈' }),
          expect.objectContaining({ canonicalName: '萧昀祈' }),
          expect.objectContaining({ canonicalName: '春桃' }),
          expect.objectContaining({ canonicalName: '王嬷嬷' }),
        ])
      );
      expect(report.normalizedLocations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ canonicalName: '静水院' }),
          expect.objectContaining({ canonicalName: '云墨斋' }),
        ])
      );
      expect(report.hasChapterMarkers).toBe(true);
      expect(report.sceneCandidates.length).toBeGreaterThanOrEqual(4);
      expect(report.sceneCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            candidateId: expect.stringMatching(/^scene-candidate-/),
            source: 'paragraph',
            confidence: expect.stringMatching(/^(medium|high)$/),
            traceReason: expect.stringContaining('人物:'),
          }),
        ])
      );
      expect(report.sceneCandidates.flatMap((candidate) => candidate.characters)).toEqual(
        expect.arrayContaining(['薛知盈', '萧昀祈', '春桃', '王嬷嬷'])
      );
      expect(report.sceneCandidates.some((candidate) => candidate.location === '静水院')).toBe(true);
      expect(report.sceneCandidates.some((candidate) => candidate.location === '云墨斋')).toBe(true);
      expect(report.sceneCandidates.some((candidate) => candidate.dialogueBlockIndexes.length > 0)).toBe(
        true
      );
      expect(report.sceneCandidates.some((candidate) => candidate.actionBlockIndexes.length > 0)).toBe(
        true
      );
      expect(report.sceneCandidates[0]).toEqual(
        expect.objectContaining({
          candidateId: expect.stringMatching(/^scene-candidate-/),
          source: 'paragraph',
          traceReason: expect.stringContaining('人物:'),
        })
      );
      expect(report.dialogueBlockCount).toBeGreaterThanOrEqual(3);
      expect(report.actionBlockCount).toBeGreaterThanOrEqual(3);
      expect(report.missingCapabilities).not.toContain('characters');
      expect(report.missingCapabilities).not.toContain('locations');
      expect(report.qualityGate.status).toBe('pass');
      expect(report.qualityGate.blockingReasons).toEqual([]);
      expect(context.summary).toContain('覆盖率：');
      expect(context.summary).toContain('质量门禁：pass');
    });

    it('keeps scene candidate recall when novel text uses single newlines and unquoted dialogue', () => {
      const sample = [
        '第一章 藏起律法书，只为等首辅回府',
        '仲春，静水院一片寂静。薛知盈已过及笄年纪，却仍被萧家用婚事拿捏。',
        '春桃抱着针线篮进门，低声说：姑娘，王嬷嬷来了，夫人请你去云墨斋。',
        '薛知盈翻书，藏起律法书，抬头看见萧昀祈立在窗外回廊下。',
        '王嬷嬷推门进来，笑着劝她：表姑娘，今日别再闹了。',
        '萧昀祈没有进屋，只隔着窗说：若她不愿，这门亲事谁也不能替她定。',
      ].join('\n');

      const report = buildNovelAnalysisCoverageReport(sample);

      expect(report.paragraphCount).toBeGreaterThanOrEqual(6);
      expect(report.dialogueBlockCount).toBeGreaterThanOrEqual(3);
      expect(report.actionBlockCount).toBeGreaterThanOrEqual(4);
      expect(report.sceneCandidateCount).toBeGreaterThanOrEqual(4);
      expect(report.extractedCharacters).toEqual(
        expect.arrayContaining(['薛知盈', '萧昀祈', '春桃', '王嬷嬷'])
      );
      expect(report.extractedLocations).toEqual(expect.arrayContaining(['静水院', '云墨斋']));
      expect(report.sceneCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'paragraph',
            characters: expect.arrayContaining(['春桃', '王嬷嬷']),
            location: '云墨斋',
            dialogueBlockIndexes: expect.arrayContaining([1]),
          }),
          expect.objectContaining({
            source: 'paragraph',
            characters: expect.arrayContaining(['薛知盈', '萧昀祈']),
            actionBlockIndexes: expect.any(Array),
          }),
        ])
      );
      expect(report.qualityGate.status).toBe('pass');
    });

    it('blocks weak story-source inputs before downstream studio generation', () => {
      const report = buildNovelAnalysisCoverageReport('他们继续向前走，没有停下。');

      expect(report.qualityGate.status).toBe('blocked');
      expect(report.qualityGate.blockingReasons).toEqual(
        expect.arrayContaining(['characters_missing', 'locations_missing', 'action_blocks_missing'])
      );
      expect(report.sceneCandidates).toEqual([]);
      expect(report.qualityGate.nextActions.length).toBeGreaterThan(0);
    });

    it('generalizes across off-screen handoff and blame-shift scenes', () => {
      const semantics = extractSceneSemantics(
        '凌晨，档案室外的走廊尽头，林夏不敢回头。赵真只说周沉已经把钥匙交给陈河，如果她现在还不认，明天所有证据都会算到她头上。'
      );

      expect(semantics.characters).toHaveLength(4);
      expect(semantics.characters).toEqual(expect.arrayContaining(['林夏', '赵真', '周沉', '陈河']));
      expect(semantics.location).toBe('档案室外的走廊尽头');
      expect(semantics.timeOfDay).toBe('夜晚');
      expect(semantics.conflictSummary).toContain('算到她头上');
      expect(semantics.semanticSummary).toContain('地点：档案室外的走廊尽头');
    });

    it('generalizes across cross-paragraph handoff and blame-shift scenes', () => {
      const semantics = extractSceneSemantics(
        [
          '夜里，配电室外的楼梯拐角，林夏一直站着，没有进去。',
          '她听见周沉在门里压低声音说，赵真替陈河把名单换过了。',
          '如果明早问起来，这件事就会算到林夏头上。',
        ].join('\n\n')
      );

      expect(semantics.characters).toHaveLength(4);
      expect(semantics.characters).toEqual(
        expect.arrayContaining(['林夏', '周沉', '赵真', '陈河'])
      );
      expect(semantics.location).toBe('配电室外的楼梯拐角');
      expect(semantics.timeOfDay).toBe('夜晚');
      expect(semantics.conflictSummary).toContain('算到林夏头上');
      expect(semantics.semanticSummary).toContain('角色：');
    });

    it('generalizes across layered blame-shift scenes before dawn', () => {
      const semantics = extractSceneSemantics(
        [
          '天亮前，天台入口的铁门后，林夏屏住呼吸。',
          '她听见周沉说，赵真已经替陈河顶罪。',
          '如果名单被翻出来，这口锅最后还是会扣在林夏头上。',
        ].join('\n\n')
      );

      expect(semantics.characters).toHaveLength(4);
      expect(semantics.characters).toEqual(
        expect.arrayContaining(['林夏', '周沉', '赵真', '陈河'])
      );
      expect(semantics.location).toBe('天台入口的铁门后');
      expect(semantics.timeOfDay).toBe('夜晚');
      expect(semantics.conflictSummary).toContain('扣在林夏头上');
      expect(semantics.semanticSummary).toContain('地点：天台入口的铁门后');
    });

    it('generalizes across deferred blame-accounting scenes at dusk', () => {
      const semantics = extractSceneSemantics(
        [
          '傍晚，废弃锅炉房外的检修通道尽头，林夏贴着墙，没有让脚步声传出去。',
          '她听见周沉在里面说，赵真已经替陈河把记录改了。',
          '要是今晚再有人追问，就把账记在林夏头上。',
        ].join('\n\n')
      );

      expect(semantics.characters).toEqual(
        expect.arrayContaining(['林夏', '周沉', '赵真', '陈河'])
      );
      expect(semantics.characters.length).toBeGreaterThanOrEqual(4);
      expect(semantics.location).toBe('废弃锅炉房外的检修通道尽头');
      expect(semantics.timeOfDay).toBe('傍晚');
      expect(semantics.conflictSummary).toContain('记在林夏头上');
      expect(semantics.semanticSummary).toContain('地点：废弃锅炉房外的检修通道尽头');
    });

    it('marks cross-chapter memory hits for sparse return scenes that rely on prior chapter memory', () => {
      const memoryContext = buildSemanticMemoryContext({
        shortTermSummary:
          '上一章摘要：周沉在废弃锅炉房外的检修通道尽头说，昨晚改过的记录会记在林夏头上。',
        longTermSummary:
          '废弃锅炉房外的检修通道尽头：赵真已经替陈河把记录改了；要是今晚再有人追问，就把账记在林夏头上。',
        entityStateSummary:
          '林夏位于废弃锅炉房外的检修通道尽头；周沉位于废弃锅炉房外的检修通道尽头；赵真位于废弃锅炉房外的检修通道尽头；陈河位于废弃锅炉房外的检修通道尽头。',
        seededCharacters: ['林夏', '周沉', '赵真', '陈河'],
      });

      const semantics = extractSceneSemanticsFromText(
        '第二天深夜，她又回到那里，没有开灯。门后那人提醒，钥匙已经交出去，昨晚改过的那笔账，还是记在她头上。',
        { memoryContext }
      );

      expect(semantics.location).toBe('废弃锅炉房外的检修通道尽头');
      expect(semantics.memoryContextSource).toBe('semantic-memory-stack-v1');
      expect(semantics.crossChapterMemoryHit).toBe(true);
    });

    it('returns stable empty semantics when no signals are found', () => {
      const semantics = extractSceneSemantics('他们继续向前走，没有停下。');

      expect(semantics.characters).toEqual([]);
      expect(semantics.location).toBeUndefined();
      expect(semantics.timeOfDay).toBeUndefined();
      expect(semantics.emotionalTone).toBeUndefined();
      expect(semantics.conflictSummary).toBeUndefined();
      expect(semantics.semanticSummary).toContain('未识别出稳定语义线索');
    });
  });

  describe('enrichAnalyzedStructureSemantics', () => {
    it('adds scene-level semantics without changing existing shot structure', () => {
      const baseStructure = {
        projectId: 'project-semantic',
        seasons: [],
        episodes: [
          {
            index: 1,
            title: 'Episode 1',
            summary: '',
            scenes: [
              {
                index: 1,
                title: 'Scene 1',
                summary: '清晨，林夏在旧码头与陈河对峙。',
                shots: [
                  {
                    index: 1,
                    text: '清晨，林夏来到旧码头。',
                  },
                  {
                    index: 2,
                    text: '陈河质问她为何隐瞒真相，两人对峙。',
                  },
                ],
              },
            ],
          },
        ],
        stats: {
          seasonsCount: 0,
          episodesCount: 1,
          scenesCount: 1,
          shotsCount: 2,
        },
      } as any;

      const enriched = enrichAnalyzedStructureSemantics(baseStructure);
      const episode = enriched.episodes[0];
      const scene = enriched.episodes[0].scenes[0];

      expect(episode.summary).toContain('章节角色：');
      expect(scene.shots).toHaveLength(2);
      expect(scene.characters).toEqual(['林夏', '陈河']);
      expect(scene.location).toBe('旧码头');
      expect(scene.timeOfDay).toBe('清晨');
      expect(scene.conflictSummary).toContain('质问');
      expect(scene.chapterContextSummary).toContain('章节角色：');
      expect(scene.semanticMethod).toBe('contextual-semantic-engine-v1');
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
        scene: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({
            id: 'scene-1',
            sceneIndex: 1,
            title: 'Scene 1',
            summary: 'summary',
          }),
        },
        shot: {
          findUnique: jest.fn().mockResolvedValue(null),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
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

    it('reuses legacy project episodes when migrating into season mode', async () => {
      const structureWithSeason = {
        projectId: 'project-legacy',
        seasons: [
          {
            index: 1,
            title: 'Season 1',
            summary: '',
            episodes: [
              {
                index: 1,
                title: 'Episode 1',
                summary: '',
                scenes: [],
              },
            ],
          },
        ],
        episodes: [],
        stats: {
          seasonsCount: 1,
          episodesCount: 1,
          scenesCount: 0,
          shotsCount: 0,
        },
      } as any;

      const tx = {
        novel: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        season: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({
            id: 'season-1',
            index: 1,
            title: 'Season 1',
            description: null,
          }),
        },
        novelVolume: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        episode: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([
              {
                id: 'legacy-episode-1',
                index: 1,
                name: 'Legacy Episode 1',
                summary: null,
                scenes: [],
              },
            ])
            .mockResolvedValueOnce([
              {
                id: 'legacy-episode-1',
                index: 1,
                name: 'Episode 1',
                summary: null,
                scenes: [],
              },
            ]),
          update: jest.fn().mockResolvedValue({
            id: 'legacy-episode-1',
            index: 1,
            name: 'Episode 1',
            summary: null,
            scenes: [],
          }),
          create: jest.fn(),
        },
      } as any;

      const result = await applyAnalyzedStructureToDatabase(tx, structureWithSeason);

      expect(tx.episode.update).toHaveBeenCalledTimes(1);
      expect(tx.episode.create).not.toHaveBeenCalled();
      expect(result.stats.updated.episodes).toBe(1);
    });

    it('persists semantic scene fields into existing scene columns', async () => {
      const tx = createFlatModeTx() as any;
      const structureWithSemantics = {
        projectId: 'project-1',
        seasons: [],
        episodes: [
          {
            index: 1,
            title: 'Episode 1',
            summary: '',
            scenes: [
              {
                index: 1,
                title: 'Scene 1',
                summary: '清晨，林夏在旧码头与陈河对峙。',
                characters: ['林夏', '陈河'],
                location: '旧码头',
                timeOfDay: '清晨',
                emotionalTone: '紧张',
                conflictSummary: '陈河质问林夏隐瞒真相',
                semanticSummary: '角色：林夏、陈河；地点：旧码头；时间：清晨；冲突：陈河质问林夏隐瞒真相',
                chapterContextSummary: '章节角色：林夏、陈河；章节地点：旧码头；章节时间：清晨；章节冲突：陈河质问林夏隐瞒真相',
                semanticMethod: 'contextual-semantic-engine-v1',
                fallbackStrategy: 'rule-based-fallback-v1',
                shots: [
                  {
                    index: 1,
                    title: '镜头 1',
                    summary: '林夏来到旧码头',
                    text: '林夏来到旧码头。',
                  },
                ],
              },
            ],
          },
        ],
        stats: {
          seasonsCount: 0,
          episodesCount: 1,
          scenesCount: 1,
          shotsCount: 1,
        },
      } as any;

      await applyAnalyzedStructureToDatabase(tx, structureWithSemantics);

      expect(tx.scene.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            characters: ['林夏', '陈河'],
            locationSlug: '旧码头',
            timeOfDay: '清晨',
            enrichedText: expect.stringContaining('角色：林夏、陈河'),
            graphStateSnapshot: expect.objectContaining({
              semanticExtraction: expect.objectContaining({
                characters: ['林夏', '陈河'],
                location: '旧码头',
                timeOfDay: '清晨',
                emotionalTone: '紧张',
                conflictSummary: '陈河质问林夏隐瞒真相',
                chapterContextSummary: expect.stringContaining('章节角色：林夏、陈河'),
                method: 'contextual-semantic-engine-v1',
                fallbackStrategy: 'rule-based-fallback-v1',
              }),
            }),
          }),
          update: expect.objectContaining({
            characters: ['林夏', '陈河'],
            locationSlug: '旧码头',
            timeOfDay: '清晨',
            enrichedText: expect.stringContaining('角色：林夏、陈河'),
          }),
        })
      );
    });
  });

  describe('getNovelContentStream', () => {
    async function readStream(stream: Readable) {
      let result = '';
      for await (const chunk of stream) {
        result += String(chunk);
      }
      return result;
    }

    it('prefers chapterId content before falling back to project latest novel', async () => {
      const prisma = {
        novelChapter: {
          findUnique: jest.fn().mockResolvedValue({
            title: '第1章：旧码头对峙',
            rawContent: '清晨，林夏来到旧码头。',
          }),
        },
        novel: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'novel-1',
          }),
        },
      } as any;

      const stream = await getNovelContentStream({ chapterId: 'chapter-1' }, prisma, 'project-1');
      const content = await readStream(stream);

      expect(content).toContain('第1章：旧码头对峙');
      expect(content).toContain('清晨，林夏来到旧码头。');
      expect(prisma.novelChapter.findUnique).toHaveBeenCalledWith({
        where: { id: 'chapter-1' },
        select: { title: true, rawContent: true },
      });
      expect(prisma.novel.findUnique).not.toHaveBeenCalled();
    });
  });
});
