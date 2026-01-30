const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Usage: node tools/novel_ingest/create_mock_docx.js <outputPath> <numChapters>

async function createMockDocx(outputPath, numChapters = 58) {
  const zip = new JSZip();

  // [Content_Types].xml - Standard structure
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
        </Types>`
  );

  // _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>`
  );

  // word/_rels/document.xml.rels
  zip.folder('word/_rels').file(
    'document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        </Relationships>`
  );

  // word/document.xml
  let bodyContent = '';

  // Ancient Style Content Generator
  const generateChapterText = (chNum) => {
    // Characters: 薛知盈 (Xue Zhiying), 萧昀祈 (Xiao Yunqi), 春桃 (Chuntao), 王嬷嬷 (Wang Momo)
    // Locations: 萧府小院 (Xiao Mansion Courtyard), 书案房 (Study), 客栈雅间 (Inn Room)

    const scenes = [
      `薛知盈坐在${chNum % 2 === 0 ? '萧府小院' : '客栈雅间'}的窗前，望着窗外的落花发呆。`,
      `“姑娘，天凉了，加件衣裳吧。”春桃拿着一件披风走了进来，脸上满是关切。`,
      '萧昀祈从书案房大步走来，面色凝重，似乎带来了什么不好的消息。',
      '“这表姑娘又跑了？”王嬷嬷在回廊下低声嘀咕，手里还端着一碗刚熬好的燕窝。',
      '薛知盈叹了一口气，她实在不想卷入这京城的纷争之中。',
      '“只要能离开这里，去哪里都好。”她轻声说道，眼中闪过一丝坚定。',
      '街市上熙熙攘攘，马车穿梭而过，没有人注意到这深宅大院里的波澜。',
      '萧昀祈紧紧握住了手中的信笺，指节泛白。“无论她跑到天涯海角，我都要把她找回来。”',
      '风吹过庭院的梧桐树，发出沙沙的响声，仿佛在诉说着一段不为人知的往事。',
      '这是一场关于逃离与追逐的游戏，而他们都身在局中，无法自拔。',
    ];

    // Generate ~6000 chars per chapter
    // Each scene block is approx ~300 chars. Need ~20 blocks.
    let text = '';
    for (let j = 0; j < 20; j++) {
      text += scenes.join('') + ' ';
    }
    return text;
  };

  for (let i = 1; i <= numChapters; i++) {
    // Heading 1: 第X章
    bodyContent += `
        <w:p>
            <w:pPr>
                <w:pStyle w:val="Heading1"/>
            </w:pPr>
            <w:r>
                <w:t>第${i}章 表姑娘又跑了${i}</w:t>
            </w:r>
        </w:p>`;

    // Text paragraphs
    bodyContent += `
        <w:p>
            <w:r>
                <w:t>${generateChapterText(i)}</w:t>
            </w:r>
        </w:p>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
            ${bodyContent}
        </w:body>
    </w:document>`;

  zip.folder('word').file('document.xml', documentXml);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log(
    `Mock Docx created at ${outputPath} with ${numChapters} chapters (Ancient Style: Xue Zhiying & Xiao Yunqi).`
  );
}

const outFile = process.argv[2] || 'docs/novels/source/BOOK.docx';
createMockDocx(outFile).catch(console.error);
