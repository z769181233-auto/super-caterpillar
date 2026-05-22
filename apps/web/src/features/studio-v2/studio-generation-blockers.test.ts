import assert from 'node:assert/strict';
import { formatStudioGenerationError } from './studio-generation-blockers';

const episodePlanBlocker = formatStudioGenerationError(
  'No usable scene candidates found for EpisodePlan generation.\nRequired threshold: at least 1 usable medium/high scene candidate per chapter.',
  '剧集规划'
);

assert.match(episodePlanBlocker, /小说分析质量门禁阻断/);
assert.match(episodePlanBlocker, /不是页面卡住/);
assert.match(episodePlanBlocker, /章节拆分、人物抽取、场景抽取、对白块、动作块和 scene candidates/);

const directorBlocker = formatStudioGenerationError(
  'No stable scene candidate evidence found for DirectorScript generation.\nRequired evidence: scene-candidate id, confidence, sourceBlocks, text, characters, and at least one location/dialogue/action trace.',
  '导演剧本'
);

assert.match(directorBlocker, /导演剧本已被小说分析质量门禁阻断/);

const unrelatedError = formatStudioGenerationError('Unauthorized', '剧集规划');
assert.equal(unrelatedError, 'Unauthorized');

console.log('studio-generation-blockers tests passed');
