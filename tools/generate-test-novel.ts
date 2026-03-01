import * as fs from 'fs';
import * as path from 'path';

// Config
const TARGET_SIZE_MB = 0.5; // ~500kb is roughly 100-200k Chinese chars
const OUTPUT_FILE = path.join(process.cwd(), 'docs/novels/source/test_novel_100k.txt');

function generateNovel() {
  console.log(`Generating novel file...`);
  const writeStream = fs.createWriteStream(OUTPUT_FILE);

  writeStream.write('第1卷 商业级测试\n');

  let size = 0;
  // 300 chars per chunk
  const chunk =
    '薛知盈坐在窗前，看着窗外的落花发呆。“姑娘，天凉了，加件衣裳吧。”春桃拿着一件披风走了进来。萧昀祈从书案房大步走来，面色凝重。“这表姑娘又跑了？”王嬷嬷在回廊下低声嘀咕。薛知盈叹了一口气，“只要能离开这里，去哪里都好。”\n'.repeat(
      2
    );

  let chapterCount = 0;
  while (size < TARGET_SIZE_MB * 1024 * 1024) {
    if (size % (50 * 1024) === 0) {
      // Every 50KB a chapter
      chapterCount++;
      writeStream.write(`\n第${chapterCount}章 测试章节${chapterCount}\n`);
    }
    writeStream.write(chunk);
    size += chunk.length;
  }

  writeStream.end();
  console.log(
    `Generated ${OUTPUT_FILE} (${(size / 1024).toFixed(2)} KB, ${chapterCount} chapters)`
  );
}

generateNovel();
