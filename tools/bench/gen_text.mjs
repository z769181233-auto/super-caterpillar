import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * tools/bench/gen_text.mjs
 * 生成确定性合成文本用于极限压测
 */

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    out: '/tmp/bench_15m.txt',
    chars: 15000000,
    seed: 'p6_1770212330012',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') params.out = args[++i];
    if (args[i] === '--chars') params.chars = parseInt(args[++i], 10);
    if (args[i] === '--seed') params.seed = args[++i];
  }
  return params;
}

const { out, chars, seed } = parseArgs();

console.log(`[GenText] Target: ${out}, Chars: ${chars}, Seed: ${seed}`);

const chapterTemplate = (idx) => `
第${idx}章 压测章节标题_${idx}
这是一段测试内容。用于验证 SCAN 和 CHUNK_PARSE 的性能边界。
Seed: ${seed} | Segment: ${idx}
${crypto.createHash('sha256').update(`${seed}_${idx}`).digest('hex').repeat(10)}
`;

const stream = fs.createWriteStream(out);
let currentChars = 0;
let chapterIdx = 1;

while (currentChars < chars) {
  const chunk = chapterTemplate(chapterIdx++);
  stream.write(chunk);
  currentChars += chunk.length;

  // 填充一些噪音字符直到达到目标
  if (currentChars < chars && chapterIdx % 5 === 0) {
    const noise = 'A'.repeat(Math.min(10000, chars - currentChars));
    stream.write(noise);
    currentChars += noise.length;
  }
}

stream.end(() => {
  console.log(`[GenText] Success: ${out} (${currentChars} characters)`);
});
