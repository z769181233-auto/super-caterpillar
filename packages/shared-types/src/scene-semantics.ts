export interface ExtractedSceneSemantics {
  characters: string[];
  location?: string;
  timeOfDay?: string;
  emotionalTone?: string;
  conflictSummary?: string;
  semanticSummary: string;
  chapterContextSummary?: string;
  memoryContextSummary?: string;
  memoryContextSource?: string;
  crossChapterMemoryHit?: boolean;
  semanticMethod?: string;
  fallbackStrategy?: string;
}

export interface SemanticMemoryContext {
  summary: string;
  source: 'semantic-memory-stack-v1';
  seededCharacters: string[];
  dominantLocation?: string;
  dominantTimeOfDay?: string;
  dominantEmotionalTone?: string;
  dominantConflictSummary?: string;
  shortTermSummary?: string;
  longTermSummary?: string;
  entityStateSummary?: string;
}

export interface ChapterSemanticContext {
  summary: string;
  characters: string[];
  dominantLocation?: string;
  dominantTimeOfDay?: string;
  dominantEmotionalTone?: string;
  dominantConflictSummary?: string;
  sceneWindowCount: number;
  coverageReport: NovelAnalysisCoverageReport;
  semanticMethod: 'contextual-semantic-engine-v1';
  fallbackStrategy: 'rule-based-fallback-v1';
}

export interface NovelNarrativeBlock {
  index: number;
  type: 'dialogue' | 'action';
  text: string;
  speaker?: string;
  characters: string[];
  location?: string;
}

export interface NovelSceneCandidate {
  candidateId: string;
  index: number;
  source: 'paragraph' | 'semantic_window';
  text: string;
  characters: string[];
  location?: string;
  timeOfDay?: string;
  emotionalTone?: string;
  conflictSummary?: string;
  dialogueBlockIndexes: number[];
  actionBlockIndexes: number[];
  sourceBlockIndexes: number[];
  confidence: 'low' | 'medium' | 'high';
  traceReason: string;
}

export type NovelAnalysisQualityGateStatus = 'pass' | 'warning' | 'blocked';

export interface NovelEntityCandidate {
  canonicalName: string;
  aliases: string[];
  mentionCount: number;
}

export interface NovelAnalysisQualityGate {
  status: NovelAnalysisQualityGateStatus;
  score: number;
  blockingReasons: string[];
  warnings: string[];
  nextActions: string[];
  requiredCapabilities: string[];
  optionalCapabilities: string[];
}

export interface NovelAnalysisCoverageReport {
  hasChapterMarkers: boolean;
  chapterMarkerCount: number;
  paragraphCount: number;
  sceneCandidateCount: number;
  characterCount: number;
  locationCount: number;
  dialogueBlockCount: number;
  actionBlockCount: number;
  dialogueCoverage: 'none' | 'partial' | 'present';
  actionCoverage: 'none' | 'partial' | 'present';
  extractedCharacters: string[];
  extractedLocations: string[];
  normalizedCharacters: NovelEntityCandidate[];
  normalizedLocations: NovelEntityCandidate[];
  sceneCandidates: NovelSceneCandidate[];
  missingCapabilities: string[];
  dialogueBlocks: NovelNarrativeBlock[];
  actionBlocks: NovelNarrativeBlock[];
  qualityGate: NovelAnalysisQualityGate;
}

interface RuleBasedSemantics extends Omit<ExtractedSceneSemantics, 'chapterContextSummary'> {
  semanticMethod: 'rule-based-minimal-semantic-extraction';
  fallbackStrategy: 'none';
}

export interface SceneSemanticExtractionOptions {
  seededCharacters?: string[];
  chapterContext?: ChapterSemanticContext;
  previousSceneContext?: Partial<ExtractedSceneSemantics>;
  memoryContext?: SemanticMemoryContext;
}

const TIME_OF_DAY_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: '清晨', pattern: /(清晨|黎明|破晓|天刚亮)/ },
  { label: '早晨', pattern: /(早晨|一早|上午|早上)/ },
  { label: '中午', pattern: /(中午|正午|午间)/ },
  { label: '下午', pattern: /(下午|午后)/ },
  { label: '傍晚', pattern: /(傍晚|黄昏|日落时分)/ },
  { label: '夜晚', pattern: /(夜里|夜晚|深夜|凌晨|雨夜|天亮前)/ },
];

const EMOTION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: '紧张', pattern: /(紧张|屏住呼吸|不安|忐忑)/ },
  { label: '愤怒', pattern: /(愤怒|震怒|怒火|恼火)/ },
  { label: '悲伤', pattern: /(悲伤|难过|哽咽|落泪)/ },
  { label: '恐惧', pattern: /(恐惧|害怕|惊恐|战栗)/ },
  { label: '喜悦', pattern: /(喜悦|高兴|欣喜|兴奋)/ },
  { label: '压抑', pattern: /(压抑|沉默|凝重|窒息)/ },
];

const CONFLICT_PRIORITY_KEYWORDS = [
  '逼问',
  '质问',
  '威胁',
  '背锅',
  '不开口',
  '不松口',
  '拖下水',
  '算到',
  '扣在',
  '记在',
  '顶罪',
  '争吵',
  '争执',
  '冲突',
  '对峙',
  '阻止',
  '拦住',
  '追赶',
  '拒绝',
  '反驳',
  '责备',
  '隐瞒',
  '对抗',
];

const CHARACTER_PATTERNS = [
  /(?:^|[，。！？\s])([一-龥]{2,3})(?:已过|已经|忽然|才|便|只|也|仍|正|尚|从|在|把|被|将|随|向|对)?(?:抬头|低头|看见|看向|听见|知道|明白|想起|走进|进了|出了|抱着|攥着|翻开|拾起|拿起|跪下|坐下|站起|站在|跑出|哭|笑|问|说|答|唤|喊|行礼)/g,
  /看见([一-龥]{2,3})(?:立在|站在|坐在|走进|拿着|手中|没有|正)/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})(?:没有|不曾|未曾)(?:进屋|进门|开口|回答|回头|推门)/g,
  /(?:^|[，。！？\s])([一-龥]{1,2}(?:嬷嬷|妈妈|夫人|太太|姑娘|小姐|公子|少爷|王爷|皇帝|太子|世子))(?:说|问|答|唤|走|站|看|笑|哭|递|拿|拦|劝|催|跪|行礼|进|出)?/g,
  /([一-龥]{2,3})的(?:脸|手|声音|心|目光|衣袖|书|名字|婚事|母亲|神色|眉眼)/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})(?:只|低声|轻声)?(说|问|答|看见|看到|盯着|来到|走进|冲向|拦住|质问|喊|叫|转身|抬头)/g,
  /([一-龥]{2,3})[与和跟对]([一-龥]{2,3})/g,
  /([一-龥]{2,3})在[^，。！？\n]{0,20}?(?:看着|盯着|望向)([一-龥]{2,3})/g,
  /([一-龥]{2,3})(?:低声|大声|忽然)?(?:逼问|质问|追上|拉住|拦住)([一-龥]{2,3})/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})(?:屏住呼吸|屏息|闭住呼吸)/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})(?:独自|悄悄|一直)?(?:站在|站着|守在|停在|缩在)/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})在[^，。！？\n]{0,20}?(?:低声|压低声音)?说/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})(?:没有|始终未|依旧没有)?(?:回答|开口|退让|松口)/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})(?:不敢|不愿|不肯)(?:回头|开口|承认|退让)/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})把[^，。！？\n]{0,12}?(?:推到|递到|摔在|按在)/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})就会(?:先)?(?:替|被|把)/g,
  /([一-龥]{2,3})听见([一-龥]{2,3})在[^，。！？\n]{0,12}?(?:喊|叫)([一-龥]{2,3})/g,
  /听见([一-龥]{2,3})(?:低声|压低声音)?说/g,
  /听见([一-龥]{2,3})在[^，。！？\n]{0,20}?(?:低声|压低声音)?说/g,
  /(?:^|[，。！？\s]|说)([一-龥]{2,3})已经把[^，。！？\n]{0,20}?(?:交给|递给|塞给)([一-龥]{2,3})/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})(?:已经)?替([一-龥]{2,3})把/g,
  /(?:^|[，。！？\s])([一-龥]{2,3})(?:已经)?替([一-龥]{2,3})(?:顶罪|背锅)/g,
  /如果([一-龥]{2,3})今(?:晚|夜)[^，。！？\n]{0,16}?(?:不回来|不现身|不露面)/g,
  /算到([一-龥]{2,3})头上/g,
  /扣在([一-龥]{2,3})头上/g,
  /记在([一-龥]{2,3})头上/g,
];

const CHARACTER_STOPWORDS = new Set([
  '第1章',
  '第2章',
  '第3章',
  '第4章',
  '第5章',
  '第6章',
  '第7章',
  '第8章',
  '第9章',
  '第10章',
  '场景',
  '镜头',
  '真相',
  '空气',
  '气氛',
  '目光',
  '声音',
  '旧码头',
  '来到',
  '拦住',
  '质问',
  '回答',
  '开口',
  '松口',
  '录音笔',
  '抬头',
  '低头',
  '看见',
  '喊陈河',
  '着劝她',
  '隔着窗',
  '表姑娘',
  '小姑娘',
  '大姑娘',
  '二姑娘',
  '三姑娘',
  '姑娘',
  '夫人',
  '母亲',
  '父亲',
  '祖母',
  '丫鬟',
  '侍女',
  '婆子',
  '院子',
  '窗下',
  '书房',
  '回廊',
]);

function normalizeCharacterCandidate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let candidate = value.trim();
  candidate = candidate.replace(/^(只|说|喊|叫|看见|听见|望向|看向)+/, '');
  candidate = candidate.replace(/的$/, '');
  candidate = candidate.replace(/只$/, '');
  if (candidate.length >= 3) {
    candidate = candidate.replace(/[质对来拦走看冲低转抬见]$/, '');
  }
  if (candidate.length < 2 || candidate.length > 3) {
    return undefined;
  }
  if (/^[他她你我其这那]/.test(candidate)) {
    return undefined;
  }
  const disallowedFragments = ['低声', '看着', '盯着', '逼问', '门口', '码头', '仓库'];
  if (disallowedFragments.some((fragment) => candidate.includes(fragment))) {
    return undefined;
  }
  if (
    /^(抬头|低头|转身|推门|进屋|进门|隔着|笑着|哭着|劝她|问她|说她|听见|看见)$/.test(
      candidate
    )
  ) {
    return undefined;
  }
  if (CHARACTER_STOPWORDS.has(candidate)) {
    return undefined;
  }
  return candidate;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const candidate = value.trim();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }
  return normalized;
}

function toCanonicalCandidate(value: string): string {
  return value
    .trim()
    .replace(/[：:，。！？\s]+$/g, '')
    .replace(/^(这位|那位|那个|这个)/, '');
}

function createEntityCandidates(values: string[]): NovelEntityCandidate[] {
  const counter = new Map<string, number>();
  const aliases = new Map<string, Set<string>>();

  for (const rawValue of values) {
    const canonicalName = toCanonicalCandidate(rawValue);
    if (!canonicalName) continue;
    counter.set(canonicalName, (counter.get(canonicalName) || 0) + 1);
    const aliasSet = aliases.get(canonicalName) || new Set<string>();
    aliasSet.add(rawValue.trim());
    aliases.set(canonicalName, aliasSet);
  }

  return [...counter.entries()]
    .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0], 'zh-Hans-CN') : b[1] - a[1]))
    .map(([canonicalName, mentionCount]) => ({
      canonicalName,
      aliases: [...(aliases.get(canonicalName) || new Set<string>())],
      mentionCount,
    }));
}

function incrementCounter(counter: Map<string, number>, value: string | undefined) {
  if (!value) return;
  counter.set(value, (counter.get(value) || 0) + 1);
}

function pickTopValues(counter: Map<string, number>, limit: number): string[] {
  return [...counter.entries()]
    .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0], 'zh-Hans-CN') : b[1] - a[1]))
    .slice(0, limit)
    .map(([value]) => value);
}

function splitSemanticBlocks(rawText: string): string[] {
  const paragraphs = rawText
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length > 0) {
    return paragraphs;
  }

  return rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildSemanticWindows(blocks: string[]): string[] {
  if (blocks.length <= 1) {
    return blocks;
  }

  const windows: string[] = [];
  for (let index = 0; index < blocks.length; index++) {
    const start = Math.max(0, index - 1);
    const end = Math.min(blocks.length, index + 2);
    const window = blocks.slice(start, end).join('\n\n').trim();
    if (window.length > 0) {
      windows.push(window);
    }
  }
  return uniqueStrings(windows);
}

function extractCharacters(text: string, seededCharacters: string[]): string[] {
  const names: string[] = [...seededCharacters];

  for (const pattern of CHARACTER_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      for (const rawCapture of match.slice(1)) {
        const normalizedCapture =
          typeof rawCapture === 'string' ? rawCapture.replace(/^对/, '').trim() : undefined;
        const candidate = normalizeCharacterCandidate(normalizedCapture);
        if (candidate) {
          names.push(candidate);
        }
      }
    }
  }

  return uniqueStrings(names)
    .sort((a, b) => {
      const indexA = text.indexOf(a);
      const indexB = text.indexOf(b);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    })
    .slice(0, 6);
}

function normalizeLocationAlias(value: string): string | undefined {
  const candidate = sanitizeLocationCandidate(value)
    ?.replace(/^(请你去|夫人请你去|她被带到|他被带到|被带到|来到|走进|进入|回到|赶到|到了|在|去|到|入|进|至|往)/, '')
    .replace(/(?:里|中|内|外|前|后|下|上)$/g, '')
    .trim();

  if (!candidate || candidate.length < 2) {
    return undefined;
  }

  return candidate;
}

function sanitizeLocationCandidate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const rawCandidate = value.trim();
  const embeddedLocation = rawCandidate.match(
    /(?:去|到|入|进|至|往|在)([一-龥]{2,12}(?:院|斋|阁|轩|堂|厅|殿|府|书房|厢房|正房|花园|回廊|廊下|窗下|榻前|案前))$/
  )?.[1];
  const candidate = (embeddedLocation || rawCandidate)
    .trim()
    .replace(/^(清晨|早晨|上午|中午|下午|傍晚|夜里|夜晚|深夜|凌晨|雨夜|天亮前)(?:的)?/, '')
    .replace(/^[一-龥]{2,3}(来到|走进|进入|赶到|到了)/, '')
    .replace(/(低声|压低声音)(说|问)?.*/, '')
    .replace(/(看着|盯着|望向|逼问|追上|拉住|逼近|拦住)[一-龥]{2,3}.*/, '')
    .replace(/(喊|叫)[一-龥]{2,3}(?:的名字)?.*/, '')
    .replace(/(与|和|跟|同)[一-龥]{2,3}.*/, '')
    .replace(/(对峙|争吵|冲突|质问|威胁|隐瞒).*/, '')
    .trim();

  if (
    !candidate ||
    candidate === '天亮' ||
    candidate.endsWith('头上') ||
    candidate.includes('只为') ||
    candidate.includes('首辅回府') ||
    /^第\s*[一二三四五六七八九十百千万0-9]+/.test(candidate) ||
    /^(他|她|它|那人|那边|这里|那里|此处)/.test(candidate) ||
    /(回到那|回到这|回到原地|没有开灯)/.test(candidate)
  ) {
    return undefined;
  }

  return candidate;
}

function extractLocation(text: string): string | undefined {
  const locationPatterns = [
    /(?:^|[，。！？\s])([^，。！？\n]{2,24}(?:静水院|云墨斋|院|斋|阁|轩|堂|厅|殿|府|书房|厢房|正房|花园|回廊|廊下|窗下|榻前|案前))(?:里|中|内|外|前|后|一片|，|。|！|？|\n|$)/,
    /([^，。！？\n]{2,24}(?:铁门后|门后|楼梯拐角|走廊尽头|检修通道尽头|通道尽头|楼梯口|走廊|门口|门外|仓库|码头|屋顶|街口|尽头|拐角|室外))(?:，|。|！|？|\n|$)/,
    /(?:^|[，。！？\s])([^，。！？\n]{2,24})(?:里|内|上|前)，/,
    /(?:在|来到|到了|赶到|走进|进入)([^，。！？\n]{2,24})/,
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    const candidate = sanitizeLocationCandidate(match?.[1]);
    if (candidate && !candidate.includes('为什么') && !candidate.includes('如何')) {
      return candidate;
    }
  }

  return undefined;
}

function extractLocationCandidates(text: string): string[] {
  const candidates: string[] = [];
  const patterns = [
    /(?:去|到|入|进|至|往|在)([一-龥]{2,12}(?:院|斋|阁|轩|堂|厅|殿|府|书房|厢房|正房|花园|回廊|廊下|窗下|榻前|案前))/g,
    /([^，。！？\n\s]{2,16}(?:院|斋|阁|轩|堂|厅|殿|府|书房|厢房|正房|花园|回廊|廊下|窗下|榻前|案前))/g,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = sanitizeLocationCandidate(match[1]);
      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  const primaryLocation = extractLocation(text);
  if (primaryLocation) {
    candidates.unshift(primaryLocation);
  }

  return uniqueStrings(candidates);
}

function extractAllLocations(texts: string[]): string[] {
  const locations: string[] = [];
  for (const text of texts) {
    locations.push(...extractLocationCandidates(text));
  }
  return uniqueStrings(locations.map((location) => normalizeLocationAlias(location)).filter(Boolean) as string[]);
}

function extractTimeOfDay(text: string): string | undefined {
  return TIME_OF_DAY_PATTERNS.find(({ pattern }) => pattern.test(text))?.label;
}

function extractEmotionalTone(text: string): string | undefined {
  return EMOTION_PATTERNS.find(({ pattern }) => pattern.test(text))?.label;
}

function extractConflictSummary(text: string): string | undefined {
  const sentences = text
    .split(/(?<=[。！？!?])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const keyword of CONFLICT_PRIORITY_KEYWORDS) {
    const match = sentences.find((sentence) => sentence.includes(keyword));
    if (match) {
      return match;
    }
  }

  const implicitConflictPatterns = [
    /如果[^。！？!?]{0,40}(不开口|不松口|背锅|算到|扣在|记在)/,
    /一步步逼近[^。！？!?]{0,30}/,
  ];

  for (const pattern of implicitConflictPatterns) {
    const match = sentences.find((sentence) => pattern.test(sentence));
    if (match) {
      return match;
    }
  }

  return undefined;
}

function extractDialogueBlocks(text: string, seededCharacters: string[]): NovelNarrativeBlock[] {
  const blocks: NovelNarrativeBlock[] = [];
  const dialoguePattern = /([一-龥]{2,3})?(?:低声|轻声|冷声|柔声|急声|笑着|哭着)?(?:说|问|答|唤|喊|道|劝|催)?[：:]?[“「『]([^”」』]{1,160})[”」』]/g;
  let match: RegExpExecArray | null;
  let index = 1;
  while ((match = dialoguePattern.exec(text)) !== null) {
    const speaker = normalizeCharacterCandidate(match[1]);
    const dialogueText = match[2]?.trim();
    if (!dialogueText) continue;
    const contextStart = Math.max(0, match.index - 80);
    const contextEnd = Math.min(text.length, match.index + match[0].length + 80);
    const context = text.slice(contextStart, contextEnd);
    blocks.push({
      index,
      type: 'dialogue',
      text: dialogueText,
      speaker,
      characters: extractCharacters(context, speaker ? [...seededCharacters, speaker] : seededCharacters),
      location: extractLocation(context),
    });
    index += 1;
  }
  return blocks;
}

function extractActionBlocks(text: string, seededCharacters: string[]): NovelNarrativeBlock[] {
  const actionPattern =
    /(抬头|低头|转身|起身|坐下|站起|跪下|行礼|走进|进了|出了|推门|关门|抱着|攥着|握住|翻开|拾起|拿起|递给|藏起|跑出|追上|拦住|拉住|看向|望向|听见|哭|笑|叹息|摇头|点头)/;
  const sentences = text
    .split(/(?<=[。！？!?])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  const blocks: NovelNarrativeBlock[] = [];
  for (const sentence of sentences) {
    if (!actionPattern.test(sentence)) continue;
    blocks.push({
      index: blocks.length + 1,
      type: 'action',
      text: sentence,
      characters: extractCharacters(sentence, seededCharacters),
      location: extractLocation(sentence),
    });
  }
  return blocks;
}

function detectChapterMarkerCount(rawText: string): number {
  const matches = rawText.match(/(?:^|\n)\s*(?:第\s*[一二三四五六七八九十百千万0-9]+\s*[章节回集卷部]|[0-9]+\s*[.、]\s*)/g);
  return matches?.length ?? 0;
}

function classifyBlockCoverage(count: number, paragraphCount: number): 'none' | 'partial' | 'present' {
  if (count <= 0) return 'none';
  if (paragraphCount <= 1 || count >= Math.ceil(paragraphCount / 3)) return 'present';
  return 'partial';
}

function createSceneCandidateId(index: number, source: NovelSceneCandidate['source']): string {
  return `scene-candidate-${source}-${index}`;
}

function findBlockIndexesInText(blocks: NovelNarrativeBlock[], text: string): number[] {
  return blocks
    .filter((block) => text.includes(block.text))
    .map((block) => block.index);
}

function classifySceneCandidateConfidence(params: {
  characterCount: number;
  hasLocation: boolean;
  dialogueBlockCount: number;
  actionBlockCount: number;
}): NovelSceneCandidate['confidence'] {
  const score =
    (params.characterCount > 0 ? 1 : 0) +
    (params.hasLocation ? 1 : 0) +
    (params.dialogueBlockCount > 0 ? 1 : 0) +
    (params.actionBlockCount > 0 ? 1 : 0);

  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function buildTraceReason(candidate: {
  characters: string[];
  location?: string;
  dialogueBlockIndexes: number[];
  actionBlockIndexes: number[];
}): string {
  const reasons: string[] = [];
  if (candidate.characters.length > 0) reasons.push(`人物:${candidate.characters.join('、')}`);
  if (candidate.location) reasons.push(`地点:${candidate.location}`);
  if (candidate.dialogueBlockIndexes.length > 0) reasons.push(`对白:${candidate.dialogueBlockIndexes.join(',')}`);
  if (candidate.actionBlockIndexes.length > 0) reasons.push(`动作:${candidate.actionBlockIndexes.join(',')}`);
  return reasons.length > 0 ? reasons.join('；') : '低置信场景候选';
}

function buildNovelSceneCandidates(params: {
  blocks: string[];
  windows: string[];
  dialogueBlocks: NovelNarrativeBlock[];
  actionBlocks: NovelNarrativeBlock[];
  seededCharacters: string[];
}): NovelSceneCandidate[] {
  const candidates: NovelSceneCandidate[] = [];
  const seenTexts = new Set<string>();
  const addCandidate = (
    text: string,
    source: NovelSceneCandidate['source'],
    sourceBlockIndexes: number[]
  ) => {
    const normalizedText = text.trim();
    if (!normalizedText || seenTexts.has(normalizedText)) return;

    const localCharacters = extractCharacters(normalizedText, []);
    const characters = extractCharacters(normalizedText, params.seededCharacters);
    const location = extractLocation(normalizedText);
    const timeOfDay = extractTimeOfDay(normalizedText);
    const emotionalTone = extractEmotionalTone(normalizedText);
    const conflictSummary = extractConflictSummary(normalizedText);
    const dialogueBlockIndexes = findBlockIndexesInText(params.dialogueBlocks, normalizedText);
    const actionBlockIndexes = findBlockIndexesInText(params.actionBlocks, normalizedText);
    const hasSceneSignal =
      localCharacters.length > 0 ||
      Boolean(location) ||
      Boolean(timeOfDay) ||
      Boolean(conflictSummary) ||
      dialogueBlockIndexes.length > 0 ||
      actionBlockIndexes.length > 0;

    if (!hasSceneSignal) return;

    seenTexts.add(normalizedText);
    const index = candidates.length + 1;
    const candidateCore = {
      characters,
      location,
      dialogueBlockIndexes,
      actionBlockIndexes,
    };
    candidates.push({
      candidateId: createSceneCandidateId(index, source),
      index,
      source,
      text: normalizedText,
      characters,
      location,
      timeOfDay,
      emotionalTone,
      conflictSummary,
      dialogueBlockIndexes,
      actionBlockIndexes,
      sourceBlockIndexes,
      confidence: classifySceneCandidateConfidence({
        characterCount: characters.length,
        hasLocation: Boolean(location),
        dialogueBlockCount: dialogueBlockIndexes.length,
        actionBlockCount: actionBlockIndexes.length,
      }),
      traceReason: buildTraceReason(candidateCore),
    });
  };

  params.blocks.forEach((block, blockIndex) => addCandidate(block, 'paragraph', [blockIndex + 1]));
  if (candidates.length === 0) {
    params.windows.forEach((window, windowIndex) => addCandidate(window, 'semantic_window', [windowIndex + 1]));
  }

  return candidates.slice(0, 24);
}

function buildNovelAnalysisQualityGate(
  report: Omit<NovelAnalysisCoverageReport, 'qualityGate'>
): NovelAnalysisQualityGate {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const nextActions: string[] = [];

  if (report.paragraphCount === 0) {
    blockingReasons.push('story_source_empty');
    nextActions.push('重新导入或粘贴有效小说正文');
  }
  if (report.characterCount === 0) {
    blockingReasons.push('characters_missing');
    nextActions.push('补强人物抽取或检查章节是否包含明确角色');
  }
  if (report.locationCount === 0) {
    blockingReasons.push('locations_missing');
    nextActions.push('补强场景/地点抽取或检查章节是否包含明确空间');
  }
  if (report.actionBlockCount === 0) {
    blockingReasons.push('action_blocks_missing');
    nextActions.push('补强动作块识别，避免后续镜头台本缺少人物动作');
  }
  if (report.sceneCandidateCount === 0) {
    blockingReasons.push('scene_candidates_missing');
    nextActions.push('补强场景候选识别，避免后续 Episode/Shot 无法拆分');
  }

  if (!report.hasChapterMarkers) {
    warnings.push('chapter_markers_missing');
    nextActions.push('检查章节标题或分章规则，避免长篇文本拆分不稳定');
  }
  if (report.dialogueBlockCount === 0) {
    warnings.push('dialogue_blocks_missing');
    nextActions.push('补强对白块识别，后续导演剧本可能缺少台词');
  }
  if (report.characterCount < 2) {
    warnings.push('low_character_coverage');
  }
  if (report.locationCount < 1) {
    warnings.push('low_location_coverage');
  }

  const score =
    (report.characterCount > 0 ? 25 : 0) +
    (report.locationCount > 0 ? 20 : 0) +
    (report.actionBlockCount > 0 ? 20 : 0) +
    (report.dialogueBlockCount > 0 ? 15 : 0) +
    (report.sceneCandidateCount > 0 ? 10 : 0) +
    (report.hasChapterMarkers ? 10 : 0);

  const status: NovelAnalysisQualityGateStatus =
    blockingReasons.length > 0 ? 'blocked' : warnings.length > 0 || score < 85 ? 'warning' : 'pass';

  return {
    status,
    score,
    blockingReasons: uniqueStrings(blockingReasons),
    warnings: uniqueStrings(warnings),
    nextActions: uniqueStrings(nextActions),
    requiredCapabilities: ['characters', 'locations', 'action_blocks', 'scene_candidates'],
    optionalCapabilities: ['chapter_markers', 'dialogue_blocks'],
  };
}

export function buildNovelAnalysisCoverageReport(
  rawText: string,
  options?: { seededCharacters?: string[] }
): NovelAnalysisCoverageReport {
  const normalizedText = rawText.trim();
  const blocks = splitSemanticBlocks(normalizedText);
  const windows = buildSemanticWindows(blocks);
  const allTexts = uniqueStrings([normalizedText, ...blocks, ...windows]).filter(Boolean);
  const seededCharacters = Array.isArray(options?.seededCharacters) ? options.seededCharacters : [];
  const extractedCharacters = extractCharacters(normalizedText, seededCharacters);
  const extractedLocations = extractAllLocations(allTexts).slice(0, 8);
  const dialogueBlocks = extractDialogueBlocks(normalizedText, extractedCharacters).slice(0, 24);
  const actionBlocks = extractActionBlocks(normalizedText, extractedCharacters).slice(0, 40);
  const chapterMarkerCount = detectChapterMarkerCount(normalizedText);
  const sceneCandidates = buildNovelSceneCandidates({
    blocks,
    windows,
    dialogueBlocks,
    actionBlocks,
    seededCharacters: extractedCharacters,
  });
  const sceneCandidateCount = sceneCandidates.length;

  const missingCapabilities: string[] = [];
  if (chapterMarkerCount === 0) missingCapabilities.push('chapter_markers');
  if (extractedCharacters.length === 0) missingCapabilities.push('characters');
  if (extractedLocations.length === 0) missingCapabilities.push('locations');
  if (dialogueBlocks.length === 0) missingCapabilities.push('dialogue_blocks');
  if (actionBlocks.length === 0) missingCapabilities.push('action_blocks');
  if (sceneCandidateCount === 0) missingCapabilities.push('scene_candidates');

  const reportWithoutGate: Omit<NovelAnalysisCoverageReport, 'qualityGate'> = {
    hasChapterMarkers: chapterMarkerCount > 0,
    chapterMarkerCount,
    paragraphCount: blocks.length,
    sceneCandidateCount,
    characterCount: extractedCharacters.length,
    locationCount: extractedLocations.length,
    dialogueBlockCount: dialogueBlocks.length,
    actionBlockCount: actionBlocks.length,
    dialogueCoverage: classifyBlockCoverage(dialogueBlocks.length, blocks.length),
    actionCoverage: classifyBlockCoverage(actionBlocks.length, blocks.length),
    extractedCharacters,
    extractedLocations,
    normalizedCharacters: createEntityCandidates(extractedCharacters),
    normalizedLocations: createEntityCandidates(extractedLocations),
    sceneCandidates,
    missingCapabilities,
    dialogueBlocks,
    actionBlocks,
  };

  return {
    ...reportWithoutGate,
    qualityGate: buildNovelAnalysisQualityGate(reportWithoutGate),
  };
}

function composeSemanticSummary(semantics: {
  characters: string[];
  location?: string;
  timeOfDay?: string;
  emotionalTone?: string;
  conflictSummary?: string;
}): string {
  const lines: string[] = [];

  if (semantics.characters.length > 0) {
    lines.push(`角色：${semantics.characters.join('、')}`);
  }
  if (semantics.location) {
    lines.push(`地点：${semantics.location}`);
  }
  if (semantics.timeOfDay) {
    lines.push(`时间：${semantics.timeOfDay}`);
  }
  if (semantics.emotionalTone) {
    lines.push(`情绪：${semantics.emotionalTone}`);
  }
  if (semantics.conflictSummary) {
    lines.push(`冲突：${semantics.conflictSummary}`);
  }

  return lines.length > 0 ? lines.join('；') : '未识别出稳定语义线索';
}

function extractRuleBasedSceneSemantics(
  text: string,
  options?: { seededCharacters?: string[] }
): RuleBasedSemantics {
  const normalizedText = text.trim();
  const seededCharacters = Array.isArray(options?.seededCharacters) ? options.seededCharacters : [];
  const characters = extractCharacters(normalizedText, seededCharacters);
  const location = extractLocation(normalizedText);
  const timeOfDay = extractTimeOfDay(normalizedText);
  const emotionalTone = extractEmotionalTone(normalizedText);
  const conflictSummary = extractConflictSummary(normalizedText);
  const semanticSummary = composeSemanticSummary({
    characters,
    location,
    timeOfDay,
    emotionalTone,
    conflictSummary,
  });

  return {
    characters,
    location,
    timeOfDay,
    emotionalTone,
    conflictSummary,
    semanticSummary,
    semanticMethod: 'rule-based-minimal-semantic-extraction',
    fallbackStrategy: 'none',
  };
}

function shouldCarryCharactersFromContext(text: string, currentCharacters: string[]): boolean {
  if (currentCharacters.length > 0) {
    return false;
  }
  return /(他|她|他们|她们|名单|证据|钥匙|录音笔|记录|这件事|那件事|这口锅|把账)/.test(text);
}

function shouldCarryConflictFromContext(text: string, conflictSummary?: string): boolean {
  if (conflictSummary) {
    return false;
  }
  return /(如果|要是|否则|这口锅|把账|名单|证据|不开口|不回来|顶罪|背锅|拖下水)/.test(text);
}

function buildPreviousSceneContextSummary(previousSceneContext?: Partial<ExtractedSceneSemantics>): string {
  if (!previousSceneContext) {
    return '';
  }
  return previousSceneContext.semanticSummary || '';
}

function extractDominantLocationFromEntityStateSummary(entityStateSummary: string): string | undefined {
  if (!entityStateSummary.trim()) {
    return undefined;
  }

  const locationCounter = new Map<string, number>();
  const matches = entityStateSummary.matchAll(/位于([^；。\n]+)/g);
  for (const match of matches) {
    const candidate = sanitizeLocationCandidate(match[1]);
    incrementCounter(locationCounter, candidate);
  }

  return pickTopValues(locationCounter, 1)[0];
}

export function buildSemanticMemoryContext(params: {
  shortTermSummary?: string;
  longTermSummary?: string;
  entityStateSummary?: string;
  seededCharacters?: string[];
}): SemanticMemoryContext | undefined {
  const shortTermSummary = params.shortTermSummary?.trim() || '';
  const longTermSummary = params.longTermSummary?.trim() || '';
  const entityStateSummary = params.entityStateSummary?.trim() || '';
  const seededCharacters = Array.isArray(params.seededCharacters) ? params.seededCharacters : [];

  const summaryBlocks = [
    shortTermSummary ? `短期记忆：${shortTermSummary}` : '',
    longTermSummary ? `长期记忆：${longTermSummary}` : '',
    entityStateSummary ? `实体状态：${entityStateSummary}` : '',
  ].filter(Boolean);

  if (summaryBlocks.length === 0 && seededCharacters.length === 0) {
    return undefined;
  }

  const semantic = buildChapterSemanticContext(summaryBlocks.join('\n\n'), {
    seededCharacters,
  });
  const entityDominantLocation = extractDominantLocationFromEntityStateSummary(entityStateSummary);

  return {
    summary: summaryBlocks.length > 0 ? summaryBlocks.join('\n\n') : semantic.summary,
    source: 'semantic-memory-stack-v1',
    seededCharacters: uniqueStrings([...seededCharacters, ...semantic.characters]).slice(0, 8),
    dominantLocation: entityDominantLocation || semantic.dominantLocation,
    dominantTimeOfDay: semantic.dominantTimeOfDay,
    dominantEmotionalTone: semantic.dominantEmotionalTone,
    dominantConflictSummary: semantic.dominantConflictSummary,
    shortTermSummary: shortTermSummary || undefined,
    longTermSummary: longTermSummary || undefined,
    entityStateSummary: entityStateSummary || undefined,
  };
}

export function buildChapterSemanticContext(
  rawText: string,
  options?: { seededCharacters?: string[] }
): ChapterSemanticContext {
  const blocks = splitSemanticBlocks(rawText.trim());
  const windows = buildSemanticWindows(blocks);
  const allTexts = uniqueStrings([rawText.trim(), ...windows]).filter(Boolean);

  const characterCounter = new Map<string, number>();
  const orderedCharacters: string[] = [];
  const locationCounter = new Map<string, number>();
  const timeCounter = new Map<string, number>();
  const emotionCounter = new Map<string, number>();
  const conflicts: string[] = [];

  for (const text of allTexts) {
    const semantics = extractRuleBasedSceneSemantics(text, options);
    for (const character of semantics.characters) {
      if (!orderedCharacters.includes(character)) {
        orderedCharacters.push(character);
      }
      incrementCounter(characterCounter, character);
    }
    incrementCounter(locationCounter, semantics.location);
    incrementCounter(timeCounter, semantics.timeOfDay);
    incrementCounter(emotionCounter, semantics.emotionalTone);
    if (semantics.conflictSummary) {
      conflicts.push(semantics.conflictSummary);
    }
  }

  const topRankedCharacters = pickTopValues(characterCounter, 6);
  const characters = uniqueStrings([
    ...orderedCharacters.filter((character) => topRankedCharacters.includes(character)),
    ...topRankedCharacters,
  ]).slice(0, 6);
  const coverageReport = buildNovelAnalysisCoverageReport(rawText, options);
  const coverageCharacters = coverageReport.extractedCharacters.filter(
    (character) => !characters.includes(character)
  );
  const mergedCharacters = uniqueStrings([...characters, ...coverageCharacters]).slice(0, 8);
  const dominantLocation = pickTopValues(locationCounter, 1)[0];
  const coverageLocation = coverageReport.extractedLocations.find(
    (location) => location !== dominantLocation
  );
  const dominantTimeOfDay = pickTopValues(timeCounter, 1)[0];
  const dominantEmotionalTone = pickTopValues(emotionCounter, 1)[0];
  const dominantConflictSummary = uniqueStrings(conflicts)[0];

  const summaryLines: string[] = [];
  if (mergedCharacters.length > 0) {
    summaryLines.push(`章节角色：${mergedCharacters.join('、')}`);
  }
  if (dominantLocation || coverageLocation) {
    summaryLines.push(`章节地点：${dominantLocation || coverageLocation}`);
  }
  if (dominantTimeOfDay) {
    summaryLines.push(`章节时间：${dominantTimeOfDay}`);
  }
  if (dominantEmotionalTone) {
    summaryLines.push(`章节情绪：${dominantEmotionalTone}`);
  }
  if (dominantConflictSummary) {
    summaryLines.push(`章节冲突：${dominantConflictSummary}`);
  }
  summaryLines.push(
    `覆盖率：人物${coverageReport.characterCount}、地点${coverageReport.locationCount}、对白${coverageReport.dialogueBlockCount}、动作${coverageReport.actionBlockCount}、场景候选${coverageReport.sceneCandidateCount}`
  );
  summaryLines.push(
    `质量门禁：${coverageReport.qualityGate.status}（${coverageReport.qualityGate.score}分）`
  );

  return {
    summary: summaryLines.length > 0 ? summaryLines.join('；') : '章节上下文暂无稳定语义线索',
    characters: mergedCharacters,
    dominantLocation: dominantLocation || coverageLocation,
    dominantTimeOfDay,
    dominantEmotionalTone,
    dominantConflictSummary,
    sceneWindowCount: windows.length,
    coverageReport,
    semanticMethod: 'contextual-semantic-engine-v1',
    fallbackStrategy: 'rule-based-fallback-v1',
  };
}

export function extractSceneSemanticsFromText(
  text: string,
  options?: SceneSemanticExtractionOptions
): ExtractedSceneSemantics {
  const normalizedText = text.trim();
  const chapterContext = options?.chapterContext;
  const previousSceneContext = options?.previousSceneContext;
  const memoryContext = options?.memoryContext;
  const seededCharacters = Array.isArray(options?.seededCharacters) ? options.seededCharacters : [];

  const ruleBased = extractRuleBasedSceneSemantics(normalizedText, {
    seededCharacters: uniqueStrings([...seededCharacters, ...(memoryContext?.seededCharacters || [])]),
  });

  const carryContextCharacters =
    shouldCarryCharactersFromContext(normalizedText, ruleBased.characters) && chapterContext;
  const characters = carryContextCharacters
    ? uniqueStrings([
        ...ruleBased.characters,
        ...((previousSceneContext?.characters as string[] | undefined) || []),
        ...(chapterContext?.characters || []),
        ...(memoryContext?.seededCharacters || []),
      ]).slice(0, 6)
    : ruleBased.characters;

  const usedMemoryForCharacters =
    Boolean(memoryContext) &&
    characters.some((character) => !ruleBased.characters.includes(character)) &&
    characters.some((character) => memoryContext?.seededCharacters.includes(character));

  const location =
    ruleBased.location ||
    previousSceneContext?.location ||
    memoryContext?.dominantLocation ||
    chapterContext?.dominantLocation;
  const usedMemoryForLocation =
    Boolean(memoryContext?.dominantLocation) &&
    !ruleBased.location &&
    !previousSceneContext?.location &&
    location === memoryContext?.dominantLocation;

  const timeOfDay =
    ruleBased.timeOfDay ||
    previousSceneContext?.timeOfDay ||
    memoryContext?.dominantTimeOfDay ||
    chapterContext?.dominantTimeOfDay;
  const usedMemoryForTimeOfDay =
    Boolean(memoryContext?.dominantTimeOfDay) &&
    !ruleBased.timeOfDay &&
    !previousSceneContext?.timeOfDay &&
    timeOfDay === memoryContext?.dominantTimeOfDay;

  const conflictSummary =
    ruleBased.conflictSummary ||
    (shouldCarryConflictFromContext(normalizedText, ruleBased.conflictSummary)
      ? previousSceneContext?.conflictSummary ||
        memoryContext?.dominantConflictSummary ||
        chapterContext?.dominantConflictSummary
      : undefined);
  const usedMemoryForConflict =
    Boolean(memoryContext?.dominantConflictSummary) &&
    !ruleBased.conflictSummary &&
    shouldCarryConflictFromContext(normalizedText, ruleBased.conflictSummary) &&
    !previousSceneContext?.conflictSummary &&
    conflictSummary === memoryContext?.dominantConflictSummary;

  const emotionalTone =
    ruleBased.emotionalTone ||
    (conflictSummary
      ? previousSceneContext?.emotionalTone ||
        memoryContext?.dominantEmotionalTone ||
        chapterContext?.dominantEmotionalTone
      : undefined);

  const semanticSummary = composeSemanticSummary({
    characters,
    location,
    timeOfDay,
    emotionalTone,
    conflictSummary,
  });
  const crossChapterMemoryHit =
    Boolean(memoryContext?.shortTermSummary || memoryContext?.longTermSummary) &&
    (usedMemoryForCharacters || usedMemoryForLocation || usedMemoryForTimeOfDay || usedMemoryForConflict);

  return {
    characters,
    location,
    timeOfDay,
    emotionalTone,
    conflictSummary,
    semanticSummary,
    chapterContextSummary: chapterContext?.summary || buildPreviousSceneContextSummary(previousSceneContext) || undefined,
    memoryContextSummary: memoryContext?.summary,
    memoryContextSource: memoryContext?.source,
    crossChapterMemoryHit,
    semanticMethod: chapterContext
      ? 'contextual-semantic-engine-v1'
      : 'rule-based-minimal-semantic-extraction',
    fallbackStrategy: chapterContext ? 'rule-based-fallback-v1' : 'none',
  };
}
