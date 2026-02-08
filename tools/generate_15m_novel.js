const fs = require('fs');
const path = require('path');

const targetChars = 15000000;
const episodeCount = 100;
const charsPerEpisode = Math.floor(targetChars / episodeCount);
const outputPath = path.join(process.cwd(), 'uploads/novels/test_novel_15m.txt');

if (!fs.existsSync(path.dirname(outputPath))) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

console.log(`Targeting ${targetChars} chars across ${episodeCount} episodes...`);
const writeStream = fs.createWriteStream(outputPath);

for (let i = 1; i <= episodeCount; i++) {
  writeStream.write(`第${i}集\n`);
  let currentLength = 0;
  const content = "这是一个测试段落，用于填充小说内容以达到1500万字的负载。我们需要确保系统在极端压力下依然稳定。我们希望通过这个测试，验证 StreamScan 架构的零内存炸弹特性，并观察系统在处理超大文本时的并发表现。\n";
  while (currentLength < charsPerEpisode) {
    writeStream.write(content);
    currentLength += content.length;
  }
  writeStream.write("\n\n");
}

writeStream.on('finish', () => {
  const stats = fs.statSync(outputPath);
  console.log(`Generated 15M novel at: ${outputPath}`);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
});

writeStream.end();
