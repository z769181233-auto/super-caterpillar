import { NovelAnalysisProcessorService } from './novel-analysis-processor.service';

describe('NovelAnalysisProcessorService', () => {
  function createService() {
    const prisma = {
      novelChapter: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      memoryShortTerm: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      sceneDraft: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn(),
    };

    prisma.novelChapter.findMany.mockResolvedValue([]);
    prisma.memoryShortTerm.findMany.mockResolvedValue([]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const service = new NovelAnalysisProcessorService(prisma as any);
    return { service, prisma };
  }

  it('keeps short but meaningful lines when analyzing chapter text', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-1',
      volumeId: 'volume-1',
      index: 1,
      title: '第1章：旧码头对峙',
      novelSource: { projectId: 'project-1' },
      rawContent: [
        '清晨，林夏来到旧码头。',
        '陈河拦住她，质问她为什么还要隐瞒真相。',
        '两人对峙，气氛紧张而愤怒。',
      ].join('\n'),
    });
    prisma.novelChapter.findFirst.mockResolvedValue(null);
    prisma.novelChapter.findMany.mockResolvedValue([]);
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-1' });
    prisma.memoryShortTerm.findMany.mockResolvedValue([]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.memoryShortTerm.create.mockResolvedValue({ id: 'memory-1' });
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-1' });

    await service.analyzeChapter('chapter-1');

    expect(prisma.sceneDraft.create).toHaveBeenCalledTimes(1);
    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: 'chapter-1',
          characters: [{ name: '林夏' }, { name: '陈河' }],
          location: '旧码头',
          summary: expect.stringContaining('清晨，林夏来到旧码头'),
          analysisResult: expect.objectContaining({
            method: 'contextual-semantic-engine-v1',
            chapterContextSummary: expect.stringContaining('章节角色：林夏、陈河'),
            semanticExtraction: expect.objectContaining({
              characters: ['林夏', '陈河'],
              location: '旧码头',
              timeOfDay: '清晨',
              conflictSummary: expect.stringContaining('质问'),
              chapterContextSummary: expect.stringContaining('章节角色：林夏、陈河'),
              memoryContextSummary: null,
              memoryContextSource: null,
              fallbackStrategy: 'rule-based-fallback-v1',
            }),
          }),
        }),
      })
    );
    expect(prisma.novelChapter.update).toHaveBeenCalledWith({
      where: { id: 'chapter-1' },
      data: { summary: expect.stringContaining('章节角色：林夏、陈河') },
    });
    expect(prisma.memoryShortTerm.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'project-1',
          chapterId: 'chapter-1',
          summary: expect.stringContaining('章节角色：林夏、陈河'),
        }),
      })
    );
  });

  it('persists coverage report for the fixed 表姑娘 regression sample on legacy api path', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-bg-1',
      volumeId: 'volume-1',
      index: 1,
      title: '第一章 藏起律法书，只为等首辅回府',
      novelSource: { projectId: 'project-bg' },
      rawContent: [
        '第一章 藏起律法书，只为等首辅回府',
        '',
        '仲春，静水院一片寂静。薛知盈已过及笄年纪，却仍被萧家用婚事拿捏。',
        '春桃抱着针线篮进门，低声说：“姑娘，王嬷嬷来了，夫人请你去云墨斋。”',
        '薛知盈抬头，看见萧昀祈立在窗外回廊下，手中仍握着那卷大周律疏。',
        '王嬷嬷推门进来，笑着劝她：“表姑娘，今日别再闹了。”',
        '萧昀祈没有进屋，只隔着窗说：“若她不愿，这门亲事谁也不能替她定。”',
      ].join('\n'),
    });
    prisma.novelChapter.findFirst.mockResolvedValue(null);
    prisma.novelChapter.findMany.mockResolvedValue([]);
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-bg-1' });
    prisma.memoryShortTerm.findMany.mockResolvedValue([]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.memoryShortTerm.create.mockResolvedValue({ id: 'memory-bg-1' });
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-bg-1' });

    await service.analyzeChapter('chapter-bg-1');

    expect(prisma.novelChapter.update).toHaveBeenCalledWith({
      where: { id: 'chapter-bg-1' },
      data: {
        summary: expect.stringContaining('覆盖率：'),
      },
    });
    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          analysisResult: expect.objectContaining({
            coverageReport: expect.objectContaining({
              extractedCharacters: expect.arrayContaining(['薛知盈', '萧昀祈', '春桃', '王嬷嬷']),
              extractedLocations: expect.arrayContaining(['静水院', '云墨斋']),
              normalizedCharacters: expect.arrayContaining([
                expect.objectContaining({ canonicalName: '薛知盈' }),
                expect.objectContaining({ canonicalName: '萧昀祈' }),
                expect.objectContaining({ canonicalName: '春桃' }),
                expect.objectContaining({ canonicalName: '王嬷嬷' }),
              ]),
              normalizedLocations: expect.arrayContaining([
                expect.objectContaining({ canonicalName: '静水院' }),
                expect.objectContaining({ canonicalName: '云墨斋' }),
              ]),
              hasChapterMarkers: true,
              sceneCandidates: expect.arrayContaining([
                expect.objectContaining({
                  candidateId: expect.stringMatching(/^scene-candidate-/),
                  source: 'paragraph',
                  characters: expect.arrayContaining(['薛知盈', '萧昀祈', '春桃', '王嬷嬷']),
                  location: '静水院',
                  dialogueBlockIndexes: expect.any(Array),
                  actionBlockIndexes: expect.any(Array),
                  traceReason: expect.stringContaining('人物:'),
                }),
              ]),
              dialogueBlockCount: expect.any(Number),
              actionBlockCount: expect.any(Number),
              missingCapabilities: expect.not.arrayContaining(['characters', 'locations']),
              qualityGate: expect.objectContaining({
                status: 'pass',
                blockingReasons: [],
              }),
            }),
          }),
        }),
      })
    );
    const createCall = prisma.sceneDraft.create.mock.calls[0][0];
    expect(createCall.data.analysisResult.coverageReport.dialogueBlockCount).toBeGreaterThanOrEqual(3);
    expect(createCall.data.analysisResult.coverageReport.actionBlockCount).toBeGreaterThanOrEqual(3);
    expect(
      createCall.data.analysisResult.coverageReport.normalizedCharacters.map(
        (candidate: { canonicalName: string }) => candidate.canonicalName
      )
    ).not.toContain('表姑娘');
    expect(
      createCall.data.analysisResult.coverageReport.sceneCandidates[0].dialogueBlockIndexes.length
    ).toBeGreaterThanOrEqual(3);
    expect(
      createCall.data.analysisResult.coverageReport.sceneCandidates[0].actionBlockIndexes.length
    ).toBeGreaterThanOrEqual(3);
  });

  it('marks low-quality story source as blocked instead of pretending it is studio-ready', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-low-quality',
      volumeId: 'volume-1',
      index: 1,
      title: '杂项文本',
      novelSource: { projectId: 'project-low-quality' },
      rawContent: '他们继续向前走，没有停下。',
    });
    prisma.novelChapter.findFirst.mockResolvedValue(null);
    prisma.novelChapter.findMany.mockResolvedValue([]);
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-low-quality' });
    prisma.memoryShortTerm.findMany.mockResolvedValue([]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.memoryShortTerm.create.mockResolvedValue({ id: 'memory-low-quality' });
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-low-quality' });

    await service.analyzeChapter('chapter-low-quality');

    const createCall = prisma.sceneDraft.create.mock.calls[0][0];
    expect(createCall.data.analysisResult.coverageReport.qualityGate).toEqual(
      expect.objectContaining({
        status: 'blocked',
        blockingReasons: expect.arrayContaining(['characters_missing', 'locations_missing']),
      })
    );
    expect(createCall.data.analysisResult.coverageReport.sceneCandidates).toEqual([]);
  });

  it('keeps richer semantics for denser interaction scenes on legacy api path', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-2',
      volumeId: 'volume-1',
      novelSourceId: 'novel-1',
      index: 2,
      title: '第2章：仓库追问',
      volume: { index: 1 },
      novelSource: { projectId: 'project-1' },
      rawContent: [
        '夜里，林夏在废弃仓库门口看着陈河。',
        '她低声逼问他到底把钥匙藏到了哪里。',
        '陈河沉默不答，只一步步逼近她。',
      ].join('\n'),
    });
    prisma.novelChapter.findFirst.mockResolvedValue({ summary: '上一章摘要：林夏已经开始追查钥匙。' });
    prisma.novelChapter.findMany.mockResolvedValue([
      {
        id: 'chapter-1',
        title: '第1章：旧码头相遇',
        summary: '章节角色：林夏、陈河；章节地点：旧码头；章节时间：清晨；章节冲突：陈河继续隐瞒钥匙线索。',
        index: 1,
        volume: { index: 1 },
      },
    ]);
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-2' });
    prisma.memoryShortTerm.findMany.mockResolvedValue([
      {
        chapterId: 'chapter-1',
        characterStates: {
          characters: [{ name: '林夏', location: '废弃仓库门口' }],
        },
      },
    ]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.memoryShortTerm.create.mockResolvedValue({ id: 'memory-2' });
    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 'chapter-similar', title: '相似章节', summary: '陈河继续隐瞒钥匙线索。' },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-2' });

    await service.analyzeChapter('chapter-2');

    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: 'chapter-2',
          characters: [{ name: '林夏' }, { name: '陈河' }],
          location: '废弃仓库门口',
          analysisResult: expect.objectContaining({
            semanticExtraction: expect.objectContaining({
              characters: ['林夏', '陈河'],
              location: '废弃仓库门口',
              timeOfDay: '夜晚',
              conflictSummary: expect.stringContaining('逼问'),
              semanticSummary: expect.stringContaining('角色：林夏、陈河'),
              memoryContextSummary: expect.stringMatching(/短期记忆：[\s\S]*长期记忆：/),
              memoryContextSource: 'semantic-memory-stack-v1',
              crossChapterMemoryHit: false,
            }),
          }),
        }),
      })
    );
  });

  it('keeps denser implicit-threat semantics on legacy api path', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-3',
      volumeId: 'volume-1',
      index: 3,
      title: '第3章：雨夜审讯',
      novelSource: { projectId: 'project-1' },
      rawContent: [
        '雨夜的审讯室里，林夏没有回答。',
        '陈河把录音笔推到她面前，说如果她今晚再不开口，赵真就会先替她背锅。',
        '门外脚步声越来越近。',
      ].join('\n'),
    });
    prisma.novelChapter.findFirst.mockResolvedValue({ summary: '上一章摘要：陈河继续施压。' });
    prisma.novelChapter.findMany.mockResolvedValue([]);
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-3' });
    prisma.memoryShortTerm.findMany.mockResolvedValue([]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.memoryShortTerm.create.mockResolvedValue({ id: 'memory-3' });
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-3' });

    await service.analyzeChapter('chapter-3');

    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: 'chapter-3',
          characters: [{ name: '林夏' }, { name: '陈河' }, { name: '赵真' }],
          location: '审讯室',
          analysisResult: expect.objectContaining({
            semanticExtraction: expect.objectContaining({
              characters: ['林夏', '陈河', '赵真'],
              location: '审讯室',
              timeOfDay: '夜晚',
              conflictSummary: expect.stringContaining('背锅'),
              semanticSummary: expect.stringContaining('角色：林夏、陈河、赵真'),
            }),
          }),
        }),
      })
    );
  });

  it('keeps multi-character narrative semantics on legacy api path', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-4',
      volumeId: 'volume-1',
      index: 4,
      title: '第4章：走廊密语',
      novelSource: { projectId: 'project-1' },
      rawContent: [
        '深夜，审讯室外的走廊里，林夏听见赵真在门内喊陈河的名字。',
        '她没有推门，只隔着玻璃说如果周沉今晚还不回来，所有人都会被拖下水。',
      ].join('\n'),
    });
    prisma.novelChapter.findFirst.mockResolvedValue({ summary: '上一章摘要：雨夜审讯让局势更紧。' });
    prisma.novelChapter.findMany.mockResolvedValue([]);
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-4' });
    prisma.memoryShortTerm.findMany.mockResolvedValue([]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.memoryShortTerm.create.mockResolvedValue({ id: 'memory-4' });
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-4' });

    await service.analyzeChapter('chapter-4');

    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: 'chapter-4',
          characters: [{ name: '林夏' }, { name: '赵真' }, { name: '陈河' }, { name: '周沉' }],
          location: '审讯室外的走廊',
          analysisResult: expect.objectContaining({
            semanticExtraction: expect.objectContaining({
              characters: ['林夏', '赵真', '陈河', '周沉'],
              location: '审讯室外的走廊',
              timeOfDay: '夜晚',
              conflictSummary: expect.stringContaining('拖下水'),
              semanticSummary: expect.stringContaining('角色：林夏、赵真、陈河、周沉'),
            }),
          }),
        }),
      })
    );
  });

  it('keeps off-screen handoff and blame-shift semantics on legacy api path', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-5',
      volumeId: 'volume-1',
      index: 5,
      title: '第5章：档案室外',
      novelSource: { projectId: 'project-1' },
      rawContent: [
        '凌晨，档案室外的走廊尽头，林夏不敢回头。',
        '赵真只说周沉已经把钥匙交给陈河，如果她现在还不认，明天所有证据都会算到她头上。',
      ].join('\n'),
    });
    prisma.novelChapter.findFirst.mockResolvedValue({ summary: '上一章摘要：赵真开始转移责任。' });
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-5' });
    prisma.memoryShortTerm.findMany.mockResolvedValue([]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.memoryShortTerm.create.mockResolvedValue({ id: 'memory-5' });
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-5' });

    await service.analyzeChapter('chapter-5');

    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: 'chapter-5',
          characters: expect.arrayContaining([
            { name: '林夏' },
            { name: '赵真' },
            { name: '周沉' },
            { name: '陈河' },
          ]),
          location: '档案室外的走廊尽头',
          analysisResult: expect.objectContaining({
            semanticExtraction: expect.objectContaining({
              characters: expect.arrayContaining(['林夏', '赵真', '周沉', '陈河']),
              location: '档案室外的走廊尽头',
              timeOfDay: '夜晚',
              conflictSummary: expect.stringContaining('算到她头上'),
              semanticSummary: expect.stringContaining('地点：档案室外的走廊尽头'),
            }),
          }),
        }),
      })
    );
  });

  it('keeps cross-paragraph handoff and blame-shift semantics on legacy api path', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-6',
      volumeId: 'volume-1',
      index: 6,
      title: '第6章：配电室外',
      novelSource: { projectId: 'project-1' },
      rawContent: [
        '夜里，配电室外的楼梯拐角，林夏一直站着，没有进去。',
        '',
        '她听见周沉在门里压低声音说，赵真替陈河把名单换过了。',
        '如果明早问起来，这件事就会算到林夏头上。',
      ].join('\n'),
    });
    prisma.novelChapter.findFirst.mockResolvedValue({ summary: '上一章摘要：钥匙去向已经暴露。' });
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-6' });
    prisma.memoryShortTerm.findMany.mockResolvedValue([]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.memoryShortTerm.create.mockResolvedValue({ id: 'memory-6' });
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-6' });

    await service.analyzeChapter('chapter-6');

    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: 'chapter-6',
          characters: expect.arrayContaining([
            { name: '林夏' },
            { name: '周沉' },
            { name: '赵真' },
            { name: '陈河' },
          ]),
          location: '配电室外的楼梯拐角',
          analysisResult: expect.objectContaining({
            semanticExtraction: expect.objectContaining({
              characters: expect.arrayContaining(['林夏', '周沉', '赵真', '陈河']),
              location: '配电室外的楼梯拐角',
              timeOfDay: '夜晚',
              conflictSummary: expect.stringContaining('算到林夏头上'),
            }),
          }),
        }),
      })
    );
  });

  it('keeps layered blame-shift semantics before dawn on legacy api path', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-7',
      volumeId: 'volume-1',
      index: 7,
      title: '第7章：天台入口',
      rawContent: [
        '天亮前，天台入口的铁门后，林夏屏住呼吸。',
        '',
        '她听见周沉说，赵真已经替陈河顶罪。',
        '如果名单被翻出来，这口锅最后还是会扣在林夏头上。',
      ].join('\n'),
    });
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-7' });
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-7' });

    await service.analyzeChapter('chapter-7');

    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: 'chapter-7',
          characters: expect.arrayContaining([
            { name: '林夏' },
            { name: '周沉' },
            { name: '赵真' },
            { name: '陈河' },
          ]),
          location: '天台入口的铁门后',
          analysisResult: expect.objectContaining({
            semanticExtraction: expect.objectContaining({
              characters: expect.arrayContaining(['林夏', '周沉', '赵真', '陈河']),
              location: '天台入口的铁门后',
              timeOfDay: '夜晚',
              conflictSummary: expect.stringContaining('扣在林夏头上'),
            }),
          }),
        }),
      })
    );
  });

  it('keeps deferred blame-accounting semantics at dusk on legacy api path', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-8',
      volumeId: 'volume-1',
      index: 8,
      title: '第8章：锅炉房外',
      rawContent: [
        '傍晚，废弃锅炉房外的检修通道尽头，林夏贴着墙，没有让脚步声传出去。',
        '',
        '她听见周沉在里面说，赵真已经替陈河把记录改了。',
        '要是今晚再有人追问，就把账记在林夏头上。',
      ].join('\n'),
    });
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-8' });
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-8' });

    await service.analyzeChapter('chapter-8');

    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: 'chapter-8',
          characters: expect.arrayContaining([
            { name: '林夏' },
            { name: '周沉' },
            { name: '赵真' },
            { name: '陈河' },
          ]),
          location: '废弃锅炉房外的检修通道尽头',
          analysisResult: expect.objectContaining({
            semanticExtraction: expect.objectContaining({
              characters: expect.arrayContaining(['林夏', '周沉', '赵真', '陈河']),
              location: '废弃锅炉房外的检修通道尽头',
              timeOfDay: '傍晚',
              conflictSummary: expect.stringContaining('记在林夏头上'),
              semanticSummary: expect.stringContaining('地点：废弃锅炉房外的检修通道尽头'),
            }),
          }),
        }),
      })
    );
  });

  it('marks cross-chapter memory hits on sparse return scenes on legacy api path', async () => {
    const { service, prisma } = createService();

    prisma.novelChapter.findUnique.mockResolvedValue({
      id: 'chapter-9',
      volumeId: 'volume-1',
      novelSourceId: 'novel-1',
      index: 9,
      title: '第9章：回到原地',
      volume: { index: 1 },
      novelSource: { projectId: 'project-1' },
      rawContent: [
        '第二天深夜，她又回到那里，没有开灯。',
        '门后那人提醒，钥匙已经交出去，昨晚改过的那笔账，还是记在她头上。',
      ].join('\n'),
    });
    prisma.novelChapter.findMany.mockResolvedValue([
      {
        id: 'chapter-8',
        title: '第8章：锅炉房外',
        summary: '章节角色：周沉、赵真、陈河、林夏；章节地点：废弃锅炉房外的检修通道尽头；章节时间：傍晚；章节冲突：要是今晚再有人追问，就把账记在林夏头上。',
        index: 8,
        volume: { index: 1 },
      },
      {
        id: 'chapter-7',
        title: '第7章：天台入口',
        summary: '章节角色：林夏、周沉、赵真、陈河；章节地点：天台入口的铁门后；章节时间：夜晚；章节冲突：这口锅最后还是会扣在林夏头上。',
        index: 7,
        volume: { index: 1 },
      },
    ]);
    prisma.novelChapter.update.mockResolvedValue({ id: 'chapter-9' });
    prisma.memoryShortTerm.findMany.mockResolvedValue([
      {
        chapterId: 'chapter-8',
        characterStates: {
          characters: [
            { name: '林夏', location: '废弃锅炉房外的检修通道尽头' },
            { name: '周沉', location: '废弃锅炉房外的检修通道尽头' },
            { name: '赵真', location: '废弃锅炉房外的检修通道尽头' },
            { name: '陈河', location: '废弃锅炉房外的检修通道尽头' },
          ],
        },
      },
    ]);
    prisma.memoryShortTerm.findFirst.mockResolvedValue(null);
    prisma.memoryShortTerm.create.mockResolvedValue({ id: 'memory-9' });
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        id: 'chapter-similar-9',
        title: '锅炉房外',
        summary: '周沉说昨晚改过的记录会记在林夏头上。',
      },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.sceneDraft.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sceneDraft.create.mockResolvedValue({ id: 'draft-9' });

    await service.analyzeChapter('chapter-9');

    expect(prisma.sceneDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chapterId: 'chapter-9',
          analysisResult: expect.objectContaining({
            semanticExtraction: expect.objectContaining({
              location: '废弃锅炉房外的检修通道尽头',
              memoryContextSource: 'semantic-memory-stack-v1',
              memoryContextSummary: expect.stringMatching(
                /长期记忆：[\s\S]*前序章节：第8章：锅炉房外[\s\S]*第7章：天台入口/
              ),
              crossChapterMemoryHit: true,
            }),
          }),
        }),
      })
    );
  });
});
