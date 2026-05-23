import type {
  AdaptationMode,
  CharacterProfile,
  ConsistencyIssue,
  EpisodePackage,
  EpisodeOutline,
  GenerateEpisodeOutlineInput,
  ImportNovelInput,
  NovelChapter,
  NovelImport,
  SceneScript,
  ShotScript
} from '../../../packages/domain/src';
import { createId } from './id';

const DEFAULT_LOCATIONS = ['祖宅庭院', '城门大道', '宗门广场', '山门石阶', '藏书阁', '夜雨长廊', '偏殿', '禁地边缘'];
const CHAPTER_HEADING_PATTERN =
  /^(第\s*[0-9零一二三四五六七八九十百千万两〇]+[章节卷回集部篇]\s*[^\n]{0,60}|(?:序章|楔子|引子|终章|尾声|后记|番外)\s*[^\n]{0,60})$/gm;
const TITLE_PLACEHOLDERS = new Set(['', '未命名小说', '雨夜真相', '小说正文', '新建小说']);

function now(): string {
  return new Date().toISOString();
}

export function importNovel(projectId: string, input: ImportNovelInput): {
  novel: NovelImport;
  characters: CharacterProfile[];
} {
  const normalizedText = normalizeNovelText(input.text);
  const chapters = splitIntoChapters(normalizedText);
  const characters = extractCharacters(normalizedText);
  const novel: NovelImport = {
    id: createId('novel'),
    projectId,
    title: input.title,
    author: input.author,
    wordCount: normalizedText.length,
    chapterCount: chapters.length,
    chapters,
    createdAt: now()
  };

  return { novel, characters };
}

function splitIntoChapters(text: string): NovelChapter[] {
  const normalized = normalizeNovelText(text);
  const boundaries: Array<{ heading: string; start: number; contentStart: number }> = [];
  let match: RegExpExecArray | null = null;

  while ((match = CHAPTER_HEADING_PATTERN.exec(normalized)) !== null) {
    boundaries.push({
      heading: normalizeHeading(match[0]),
      start: match.index,
      contentStart: CHAPTER_HEADING_PATTERN.lastIndex
    });
  }

  if (boundaries.length === 0) {
    return buildSyntheticChapters(normalized);
  }

  const chapters: NovelChapter[] = [];
  const leadIn = cleanupFrontMatter(normalized.slice(0, boundaries[0].start));
  if (leadIn.length >= 280) {
    chapters.push(createChapter(1, '序章', leadIn));
  }

  for (const [index, boundary] of boundaries.entries()) {
    const nextBoundary = boundaries[index + 1];
    const rawContent = normalized.slice(boundary.contentStart, nextBoundary?.start ?? normalized.length).trim();
    if (!rawContent) {
      continue;
    }

    chapters.push(createChapter(chapters.length + 1, boundary.heading, rawContent));
  }

  return chapters.length > 0 ? chapters : buildSyntheticChapters(normalized);
}

function extractCharacters(text: string): CharacterProfile[] {
  const sample = text.slice(0, 220_000);
  const scoreMap = new Map<string, number>();
  const patterns = [
    { pattern: /(?:^|。|！|？|\s|“|”)([\p{Script=Han}]{2,4})(?=说道|问道|笑道|冷声道|沉声道|低声道|看着|盯着|心中|走进|走出|盘坐|站在)/gu, weight: 6 },
    { pattern: /((?:司徒|慕容|欧阳|上官|端木|东方|南宫|独孤|夏侯|轩辕)?[\p{Script=Han}]{2,4})(?=公主|郡主|王妃|娘娘|女皇)/gu, weight: 5 },
    { pattern: /([赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤殷罗毕郝安常乐于傅皮卞齐康伍余元顾孟平黄穆萧尹姚邵湛汪祁毛禹狄米贝明成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵贾路江童颜郭梅盛林钟徐丘骆高夏蔡田樊胡凌霍虞万支柯管卢莫经房裘干解应宗丁邓单杭洪包诸左石崔吉龚程裴陆荣翁荀羊惠甄曲封芮储靳松段富巫焦巴牧隗车侯班仰秋仲伊宫宁仇栾甘厉戎祖武符刘景詹束龙叶司冷简饶曾沙关蒯相查荆游竺权盖益桓公池][\p{Script=Han}]{1,2})/gu, weight: 3 },
    { pattern: /与([\p{Script=Han}]{2,4}?)(?=同行|对峙|交手|商议|潜入|前往|回到|低声)/gu, weight: 2 },
    { pattern: /(师兄|师父|长老|掌门|女皇|王妃|郡王|郡主)/g, weight: 1 }
  ];

  for (const { pattern, weight } of patterns) {
    for (const match of sample.matchAll(pattern)) {
      const name = match[1];
      if (!looksLikeCharacterName(name)) {
        continue;
      }
      scoreMap.set(name, (scoreMap.get(name) || 0) + weight);
    }
  }

  const blocked = new Set([
    '第一章',
    '第二章',
    '第三章',
    '第四章',
    '雨夜',
    '真相',
    '夜查',
    '对峙',
    '宗门广',
    '门广场',
    '山门石',
    '藏书阁',
    '禁地',
    '广场',
    '长廊',
    '现实不',
    '苏苒潜',
    '林川在',
    '黄极境',
    '云武郡',
    '武印记',
    '王子殿',
    '王子的',
    '时候',
    '武者',
    '经脉',
    '武技',
    '武市钱',
    '万枚银',
    '那一位',
    '可以',
    '要知',
    '淡淡的',
    '向着',
    '沉声',
    '低声',
    '盯着',
    '郡主',
    '郡王',
    '王子',
    '王妃',
    '王后娘'
  ]);

  const names = Array.from(scoreMap.entries())
    .map(([name, score]) => ({ name, score }))
    .filter((item) => !blocked.has(item.name))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.name)
    .slice(0, 6);

  if (names.length === 0) {
    names.push('主角', '同伴');
  }

  return names.slice(0, 4).map((name, index) => ({
    id: createId('char'),
    name,
    role: index === 0 ? 'protagonist' : 'supporting',
    identitySummary: index === 0 ? '故事推动核心人物' : '关键陪衬角色',
    speechStyle: index === 0 ? '直接、克制、带目标感' : '辅助推进、补充信息'
  }));
}

export function generateEpisodeOutline(
  projectId: string,
  title: string,
  chapters: NovelChapter[],
  input: GenerateEpisodeOutlineInput
): EpisodeOutline {
  const adaptationMode: AdaptationMode = input.adaptationMode || 'faithful';
  const summaryBlock = chapters.slice(0, 3).map((chapter) => chapter.summary).join('；');

  return {
    id: createId('outline'),
    projectId,
    episodeNo: input.episodeNo,
    adaptationMode,
    estimatedMinutes: input.estimatedMinutes ?? 24,
    title: `${title}·第${input.episodeNo}集`,
    theme: adaptationMode === 'fast_paced' ? '快速建立冲突与钩子' : '建立人物、冲突与世界规则',
    logline: `${summarize(summaryBlock, 60)}，并在集尾留下强钩子。`,
    storyGoal: '让主角完成本集阶段性认知或行动突破',
    progressPoint: '推动主线关系和当前危机升级',
    climax: '在夜雨或对峙场景中完成本集高潮爆点',
    endingHook: '抛出更大真相或新危机，形成追更动机',
    createdAt: now()
  };
}

export function generateScenes(
  projectId: string,
  outline: EpisodeOutline,
  characters: CharacterProfile[],
  chapters: NovelChapter[]
): SceneScript[] {
  const leadNames = characters.slice(0, 3).map((character) => character.name);
  const sceneCount = resolveExpectedSceneCount(outline.estimatedMinutes);
  const sourceChapters = pickEpisodeChapters(chapters, outline.episodeNo, sceneCount);

  return sourceChapters.map((chapter, index) => ({
    id: createId('scene'),
    projectId,
    episodeOutlineId: outline.id,
    sceneNo: index + 1,
    title: resolveSceneTitle(chapter, index, sourceChapters.length),
    location: resolveLocationFromChapter(chapter, index),
    timeOfDay: resolveTimeOfDay(chapter.summary, index),
    characters: resolveSceneCharacters(leadNames, index, sourceChapters.length),
    sceneGoal: resolveSceneGoal(index, sourceChapters.length),
    conflictSource: resolveConflictSource(index, chapter.summary),
    actionText: buildSceneActionText(chapter, index, sourceChapters.length),
    dialogueText: resolveDialogue(leadNames, index, chapter.summary, sourceChapters.length),
    emotionGoal: resolveEmotionGoal(index, sourceChapters.length),
    exitResult: resolveExitResult(index, sourceChapters.length),
    evidenceLevel: resolveEvidenceLevel(index, sourceChapters.length)
  }));
}

export function buildEpisodePackage(
  projectId: string,
  title: string,
  chapters: NovelChapter[],
  characters: CharacterProfile[],
  input: GenerateEpisodeOutlineInput
): EpisodePackage {
  const outline = generateEpisodeOutline(projectId, title, chapters, input);
  const scenes = generateScenes(projectId, outline, characters, chapters);
  const shots = scenes.flatMap((scene) => generateShots(projectId, scene));
  const issues = reviewConsistency(projectId, scenes, shots, { characters, outline });

  return {
    outline,
    scenes,
    shots,
    issues
  };
}

export function generateShots(projectId: string, scene: SceneScript): ShotScript[] {
  const baseShots: ShotScript[] = [
    {
      id: createId('shot'),
      projectId,
      sceneId: scene.id,
      shotNo: 1,
      shotType: 'establishing',
      cameraAngle: '平视',
      cameraMove: '缓慢推进',
      durationSec: 4,
      visualFocus: `${scene.location}的空间与氛围建立`,
      performanceFocus: '先建立环境压迫感与空间秩序'
    },
    {
      id: createId('shot'),
      projectId,
      sceneId: scene.id,
      shotNo: 2,
      shotType: 'medium',
      cameraAngle: '对切',
      cameraMove: '轻微跟随',
      durationSec: 5,
      visualFocus: '人物关系站位与行动目标',
      performanceFocus: scene.emotionGoal
    },
    {
      id: createId('shot'),
      projectId,
      sceneId: scene.id,
      shotNo: 3,
      shotType: 'insert',
      cameraAngle: '细节特写',
      cameraMove: '快速切入',
      durationSec: 3,
      visualFocus: '关键道具、线索或环境异象',
      performanceFocus: scene.conflictSource
    },
    {
      id: createId('shot'),
      projectId,
      sceneId: scene.id,
      shotNo: 4,
      shotType: 'closeup',
      cameraAngle: '近景特写',
      cameraMove: '定镜',
      durationSec: 4,
      visualFocus: '情绪爆点或关键信息',
      performanceFocus: scene.exitResult
    }
  ];

  if (scene.evidenceLevel === 'manual_review_required' || scene.title.includes('尾钩')) {
    baseShots.push({
      id: createId('shot'),
      projectId,
      sceneId: scene.id,
      shotNo: 5,
      shotType: 'closeup',
      cameraAngle: '极近特写',
      cameraMove: '慢推至停',
      durationSec: 4,
      visualFocus: '尾钩信息、危险提示或角色决断',
      performanceFocus: '以强悬念结束场次'
    });
  }

  return baseShots;
}

export function reviewConsistency(
  projectId: string,
  scenes: SceneScript[],
  shots: ShotScript[],
  context?: {
    characters?: CharacterProfile[];
    outline?: EpisodeOutline;
  }
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  if (scenes.length === 0) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'narrative',
      severity: 'high',
      description: '当前集尚未生成分场，无法进入导演与视频阶段。',
      suggestion: '先完成 episode outline 到 scene scripts 的生成。'
    });
  }

  for (const scene of scenes) {
    if (scene.characters.length === 0) {
      issues.push({
        id: createId('issue'),
        projectId,
        type: 'character',
        severity: 'medium',
        description: `场次 ${scene.sceneNo} 缺少明确出场角色。`,
        suggestion: '补充该场的角色清单并回写角色状态。'
      });
    }
  }

  for (const scene of scenes) {
    const shotCount = shots.filter((shot) => shot.sceneId === scene.id).length;
    if (shotCount === 0) {
      issues.push({
        id: createId('issue'),
        projectId,
        type: 'narrative',
        severity: 'medium',
        description: `场次 ${scene.sceneNo} 尚未生成镜头脚本。`,
        suggestion: '生成 shot scripts 后再进入预演。'
      });
    }
    if (shotCount > 0 && shotCount < 3) {
      issues.push({
        id: createId('issue'),
        projectId,
        type: 'narrative',
        severity: 'low',
        description: `场次 ${scene.sceneNo} 镜头数量偏少，可能导致信息表达不足。`,
        suggestion: '补足建立镜头、推进镜头与情绪特写。'
      });
    }
  }

  for (const [index, scene] of scenes.entries()) {
    if (scene.sceneNo !== index + 1) {
      issues.push({
        id: createId('issue'),
        projectId,
        type: 'timeline',
        severity: 'high',
        description: `场次编号不连续：预期 ${index + 1}，实际 ${scene.sceneNo}。`,
        suggestion: '重新排序分场编号，确保导演和制片链路稳定。'
      });
    }
  }

  const protagonistName = resolveProtagonistName(context?.characters, scenes);
  if (protagonistName) {
    const openingScene = scenes[0];
    if (openingScene && !openingScene.characters.includes(protagonistName)) {
      issues.push({
        id: createId('issue'),
        projectId,
        type: 'character',
        severity: 'high',
        description: '主角未在第一场出现，开篇抓力不足。',
        suggestion: '让主角在第一场明确进入画面或被强提示。'
      });
    }

    const finalScene = scenes[scenes.length - 1];
    if (finalScene && !finalScene.characters.includes(protagonistName)) {
      issues.push({
        id: createId('issue'),
        projectId,
        type: 'character',
        severity: 'medium',
        description: '主角未出现在尾钩场，集尾牵引力偏弱。',
        suggestion: '让主角承担尾钩视角或在尾钩中明确做出反应。'
      });
    }
  }

  const protagonistSceneCount = protagonistName
    ? scenes.filter((scene) => scene.characters.includes(protagonistName)).length
    : 0;
  if (protagonistName && scenes.length > 0 && protagonistSceneCount < Math.ceil(scenes.length / 2)) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'character',
      severity: 'medium',
      description: '主角在本集分场中的持续在场不足，人物主线容易失焦。',
      suggestion: '让主角参与至少一半关键场次，确保视角与情绪主线稳定。'
    });
  }

  const hasEscalation = scenes.some((scene) => scene.emotionGoal.includes('爆发') || scene.emotionGoal.includes('升级'));
  if (!hasEscalation && scenes.length > 0) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'narrative',
      severity: 'medium',
      description: '当前分场缺少明显情绪升级或高潮场。',
      suggestion: '在中后段增加对峙升级或情绪爆发段落。'
    });
  }

  const hasManualReviewScene = scenes.some((scene) => scene.evidenceLevel === 'manual_review_required');
  if (!hasManualReviewScene && scenes.length > 0) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'narrative',
      severity: 'low',
      description: '当前整集没有标记需要人工确认的高风险场次。',
      suggestion: '对关键真相或尾钩场次增加人工复核标记。'
    });
  }

  const openingScene = scenes[0];
  if (openingScene && !hasOpeningHook(openingScene)) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'narrative',
      severity: 'high',
      description: '开场场次缺少足够强的事件钩子，动画首分钟抓力不足。',
      suggestion: '首场应明确给出异常事件、视觉异象、危机目标或强悬念信息。'
    });
  }

  const finalScene = scenes[scenes.length - 1];
  if (finalScene && !hasEndingSuspense(finalScene, context?.outline)) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'narrative',
      severity: 'high',
      description: '尾场悬念不足，难以形成追更驱动力。',
      suggestion: '在尾场加入未解答真相、升级威胁或必须继续行动的新任务。'
    });
  }

  const expectedSceneCount = resolveExpectedSceneCount(context?.outline?.estimatedMinutes);
  if (scenes.length > 0 && scenes.length < expectedSceneCount) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'narrative',
      severity: 'medium',
      description: `当前分场数量偏少：预估时长 ${context?.outline?.estimatedMinutes ?? 24} 分钟，建议至少 ${expectedSceneCount} 场。`,
      suggestion: '补充过桥场、关系推进场和高潮前准备场，提升单集节奏承载力。'
    });
  }

  const averageShotsPerScene = scenes.length > 0 ? shots.length / scenes.length : 0;
  if (scenes.length > 0 && averageShotsPerScene < 3.2) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'narrative',
      severity: 'medium',
      description: `平均每场镜头数为 ${averageShotsPerScene.toFixed(1)}，导演拆解密度不足。`,
      suggestion: '补充分场转场镜头、情绪反应镜头和信息强调镜头。'
    });
  }

  const dominantLocation = findDominantLocation(scenes);
  if (dominantLocation) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'location',
      severity: 'medium',
      description: `主要场景过度集中在「${dominantLocation}」，空间变化不足。`,
      suggestion: '增加外景、过桥地点或功能型场景，强化世界层次和视觉节奏。'
    });
  }

  const repeatedConflict = findRepeatedConflictSource(scenes);
  if (repeatedConflict) {
    issues.push({
      id: createId('issue'),
      projectId,
      type: 'narrative',
      severity: 'low',
      description: `冲突来源多次重复为「${repeatedConflict}」，戏剧推进层次偏单一。`,
      suggestion: '加入人物关系冲突、规则冲突与外部事件冲突的切换。'
    });
  }

  return issues;
}

function resolveProtagonistName(characters: CharacterProfile[] | undefined, scenes: SceneScript[]): string | undefined {
  const protagonist = characters?.find((character) => character.role === 'protagonist')?.name;
  return protagonist || scenes[0]?.characters[0];
}

function hasOpeningHook(scene: SceneScript): boolean {
  const hookLexicon = ['异响', '禁地', '真相', '封印', '危机', '追查', '警告', '秘密', '失踪', '对峙'];
  const text = [scene.title, scene.sceneGoal, scene.conflictSource, scene.actionText, scene.dialogueText].join(' ');
  return hookLexicon.some((keyword) => text.includes(keyword));
}

function hasEndingSuspense(scene: SceneScript, outline?: EpisodeOutline): boolean {
  const suspenseLexicon = ['真相', '危机', '追查', '继续', '封印', '任务', '警告', '代价', '抉择', '更大'];
  const text = [scene.title, scene.exitResult, scene.dialogueText, outline?.endingHook || ''].join(' ');
  return suspenseLexicon.some((keyword) => text.includes(keyword));
}

function resolveExpectedSceneCount(estimatedMinutes = 24): number {
  return Math.max(4, Math.ceil(estimatedMinutes / 5));
}

function findDominantLocation(scenes: SceneScript[]): string | undefined {
  const locationCount = new Map<string, number>();
  for (const scene of scenes) {
    locationCount.set(scene.location, (locationCount.get(scene.location) || 0) + 1);
  }

  const dominant = Array.from(locationCount.entries()).sort((left, right) => right[1] - left[1])[0];
  if (!dominant) {
    return undefined;
  }

  return dominant[1] / Math.max(scenes.length, 1) >= 0.6 ? dominant[0] : undefined;
}

function findRepeatedConflictSource(scenes: SceneScript[]): string | undefined {
  const conflictCount = new Map<string, number>();
  for (const scene of scenes) {
    conflictCount.set(scene.conflictSource, (conflictCount.get(scene.conflictSource) || 0) + 1);
  }

  const repeated = Array.from(conflictCount.entries()).sort((left, right) => right[1] - left[1])[0];
  if (!repeated) {
    return undefined;
  }

  return repeated[1] >= 3 ? repeated[0] : undefined;
}

function resolveTimeOfDay(summary: string, index: number): string {
  if (summary.includes('雨夜') || summary.includes('夜')) {
    return '雨夜';
  }
  if (summary.includes('黄昏')) {
    return '黄昏';
  }
  return ['白天', '黄昏', '夜晚', '雨夜', '深夜'][index] || '夜晚';
}

function resolveSceneCharacters(characters: string[], index: number, sceneCount: number): string[] {
  if (index === 0) {
    return characters;
  }
  if (index === sceneCount - 1) {
    return [characters[0] || '主角', characters[1] || '关键对手'].filter(Boolean);
  }
  if (index === 1) {
    return characters.slice(0, 2);
  }
  if (index % 2 === 0) {
    return characters;
  }
  return [characters[0] || '主角', characters[1] || '同伴'].filter(Boolean);
}

function resolveSceneGoal(index: number, sceneCount: number): string {
  const templates = [
    '快速建立角色关系和本集问题',
    '推进谜团并补充世界规则',
    '让人物目标发生正面碰撞',
    '推动局势反转并逼近核心秘密',
    '释放真相并制造情绪爆点',
    '收束本集并抛出更大危机'
  ];
  if (index === sceneCount - 1) {
    return '将本集结果转化为下一集必须立刻面对的新危机';
  }
  return templates[index] || '推进剧情';
}

function resolveConflictSource(index: number, summary: string): string {
  const templates = [
    '主角对现状的不满足',
    '资料与现实互相矛盾',
    '阻拦者出现并否定主角行动',
    '真相与原有认知冲突',
    '行动代价开始显性化',
    '新线索出现'
  ];
  if (summary.includes('杀') || summary.includes('死')) {
    return '生死旧账被重新揭开';
  }
  return templates[index] || '局势升级';
}

function resolveDialogue(characters: string[], index: number, summary: string, sceneCount: number): string {
  const lead = characters[0] || '主角';
  const support = characters[1] || '同伴';
  const templates = [
    `${lead}提出疑问，其他人回避关键真相。`,
    `${lead}与${support}围绕线索产生分歧，核心信息来自：${summarize(summary, 18)}。`,
    `${lead}坚持行动，对方则强调代价与禁忌。`,
    `${lead}被迫在情感和目标之间做选择，线索指向：${summarize(summary, 18)}。`,
    `${lead}得知真相后短暂失语，再做出选择。`,
    '用极少台词留下压迫感和继续追看的动机。'
  ];
  if (index === sceneCount - 1) {
    return `${lead}只留下必要的一句决断，${support}或对手给出更大的危险提示。`;
  }
  return templates[index] || `${lead}围绕当前问题继续推进剧情。`;
}

function resolveEmotionGoal(index: number, sceneCount: number): string {
  if (index === sceneCount - 1) {
    return '悬念拉满';
  }
  return ['压低情绪，埋入不安', '悬疑与压迫', '对峙升级', '危机逼近', '情绪爆发'][index] || '紧张推进';
}

function resolveExitResult(index: number, sceneCount: number): string {
  const templates = [
    '主角决定追查异常',
    '线索指向更危险的地点',
    '主角被迫独自推进',
    '代价开始兑现，关系出现裂痕',
    '关系与命运方向发生改变',
    '新的更大任务被抛出'
  ];
  if (index === sceneCount - 1) {
    return '新的更大任务被抛出';
  }
  return templates[index] || '剧情继续推进';
}

function resolveEvidenceLevel(index: number, sceneCount: number): SceneScript['evidenceLevel'] {
  if (index === sceneCount - 1) {
    return 'manual_review_required';
  }
  return index % 2 === 0 ? 'context_inferred' : 'style_enhanced';
}

function summarize(text: string, limit: number): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function inferNovelTitleFromText(text: string, fallbackTitle?: string): string | undefined {
  const normalized = normalizeNovelText(text);
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24);

  for (const line of lines) {
    const headerMatch = line.match(/^[『《「]?\s*([^\/《》「」『』]{2,40})\s*\/\s*作者[:：]?\s*([^》』」\n]{1,24})/);
    if (headerMatch?.[1]) {
      return headerMatch[1].trim();
    }

    const labelMatch = line.match(/^(?:书名|作品名|小说名)[:：]\s*([^《》\n]{2,40})$/);
    if (labelMatch?.[1]) {
      return labelMatch[1].trim();
    }

    const wrappedMatch = line.match(/^[《「『]\s*([^》」』]{2,40})\s*[》」』]$/);
    if (wrappedMatch?.[1] && !wrappedMatch[1].includes('内容简介') && !wrappedMatch[1].includes('状态')) {
      return wrappedMatch[1].trim();
    }
  }

  const fallback = (fallbackTitle || '').trim();
  return TITLE_PLACEHOLDERS.has(fallback) ? undefined : fallback;
}

function normalizeNovelText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function cleanupFrontMatter(text: string): string {
  const markerIndex = text.lastIndexOf('章节内容开始');
  const sliced = markerIndex >= 0 ? text.slice(markerIndex + '章节内容开始'.length) : text;
  return sliced
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.includes('下载和分享更多电子书') && !line.startsWith('https://') && !line.startsWith('简体:'))
    .join('\n');
}

function createChapter(chapterNo: number, title: string, content: string): NovelChapter {
  const summarySource = firstMeaningfulParagraph(content) || content;
  return {
    id: createId('chapter'),
    chapterNo,
    title: title.trim(),
    summary: summarize(summarySource, 88),
    excerpt: summarize(content, 180),
    wordCount: content.length
  };
}

function buildSyntheticChapters(text: string): NovelChapter[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [createChapter(1, '第1章', text.trim())];
  }

  const chunked: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length > 3800 && current) {
      chunked.push(current);
      current = paragraph;
      continue;
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }

  if (current) {
    chunked.push(current);
  }

  return chunked.map((section, index) => createChapter(index + 1, `第${index + 1}章`, section));
}

function normalizeHeading(heading: string): string {
  const cleaned = heading.replace(/\s+/g, ' ').trim();
  const numbered = cleaned.match(/^(第\s*[0-9零一二三四五六七八九十百千万两〇]+[章节卷回集部篇])\s*(.*)$/);
  if (!numbered) {
    return cleaned;
  }
  return `${numbered[1].replace(/\s+/g, '')}${numbered[2] ? ` ${numbered[2].trim()}` : ''}`.trim();
}

function firstMeaningfulParagraph(content: string): string {
  return content
    .split('\n')
    .map((line) => line.replace(/^[\s　]+/, '').trim())
    .find((line) => line.length >= 16) || '';
}

function looksLikeCharacterName(name: string | undefined): name is string {
  if (!name) {
    return false;
  }

  const normalized = name.trim();
  if (normalized.length < 2 || normalized.length > 4) {
    return false;
  }

  if (!/^[\p{Script=Han}]+$/u.test(normalized)) {
    return false;
  }

  if (/(章节|内容|开始|可以|时候|境|国|者|记|脉|榜|市|台|宫|殿|阁|门|大道|广场|长廊|样子|黄金|气池|篮球)$/u.test(normalized)) {
    return false;
  }

  return true;
}

function pickEpisodeChapters(chapters: NovelChapter[], episodeNo: number, sceneCount: number): NovelChapter[] {
  if (chapters.length === 0) {
    return [];
  }

  const start = Math.max(0, (episodeNo - 1) * sceneCount);
  const picked = chapters.slice(start, start + sceneCount);
  if (picked.length >= Math.min(sceneCount, chapters.length)) {
    return picked;
  }
  return chapters.slice(0, Math.min(sceneCount, chapters.length));
}

function resolveSceneTitle(chapter: NovelChapter, index: number, sceneCount: number): string {
  if (index === 0) {
    return `开场钩子 · ${chapter.title}`;
  }
  if (index === sceneCount - 1) {
    return `尾钩落点 · ${chapter.title}`;
  }
  return `场次 ${index + 1} · ${chapter.title}`;
}

function resolveLocationFromChapter(chapter: NovelChapter, index: number): string {
  const source = `${chapter.title} ${chapter.summary}`;
  const lexicon = [
    ['宫', '王宫'],
    ['殿', '大殿'],
    ['阁', '藏书阁'],
    ['城', '城门大道'],
    ['山', '山门石阶'],
    ['台', '祭台'],
    ['谷', '深谷'],
    ['海', '海边断崖'],
    ['墓', '古墓入口'],
    ['狱', '囚禁密室']
  ] as const;

  for (const [keyword, location] of lexicon) {
    if (source.includes(keyword)) {
      return location;
    }
  }

  return DEFAULT_LOCATIONS[index] || DEFAULT_LOCATIONS[DEFAULT_LOCATIONS.length - 1];
}

function buildSceneActionText(chapter: NovelChapter, index: number, sceneCount: number): string {
  const visualFocus = index === 0 ? '先用可视化异象或危机建立世界抓力。' : index === sceneCount - 1 ? '把最后一个信息点处理成强悬念切口。' : '把动作、调度和信息披露拆成明确节拍。';
  return `${chapter.title}：${chapter.summary}。${visualFocus}`;
}
