import * as fs from 'fs';
import * as path from 'path';
import { streamScanFile, ScanResult } from '../packages/ingest/stream_scan';

const TEST_FILE = path.join(__dirname, 'temp_novel_scan_test.txt');

async function createTestFile() {
  const writeStream = fs.createWriteStream(TEST_FILE);

  // Chapter 0 (Preface) ranges
  // Chapter 1...

  // We will write and track what we expect.
  // Actually, let's just write and then read back using the scanner's output.

  writeStream.write('Preface content line 1\nLine 2\n');

  for (let i = 1; i <= 5; i++) {
    writeStream.write(`第${i}章 Title of Chap ${i}\n`);
    writeStream.write(`Content of chapter ${i} line 1.\n`);
    writeStream.write(`Content of chapter ${i} line 2 (multibyte: 你好).\n`); // Test multibyte
  }
  // Trailing content
  writeStream.write('Epilogue line.\n');

  return new Promise<void>((resolve) => writeStream.end(resolve));
}

async function readChunk(filePath: string, start: number, end: number): Promise<string> {
  const chunks: Buffer[] = [];
  const readStream = fs.createReadStream(filePath, { start: start, end: end - 1 });
  for await (const chunk of readStream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function runTest() {
  console.log('Generating test file...');
  await createTestFile();

  console.log('Scanning file...');
  // Use ts-node to run this, so imports resolve if tsconfig paths are set.
  // But this script is in tools/.
  // We might need to adjust imports or run with tsconfig-paths.

  const episodes = await streamScanFile(TEST_FILE);
  console.log(`Scanned ${episodes.length} episodes.`);

  for (const ep of episodes) {
    console.log(`[Episode] ${ep.title} (Bytes: ${ep.startByte}-${ep.endByte})`);
    const content = await readChunk(TEST_FILE, ep.startByte, ep.endByte);
    console.log(`--- Content Start ---`);
    console.log(content.trim());
    console.log(`--- Content End ---`);

    // Basic Assertions
    if (ep.title.startsWith('第')) {
      if (!content.includes(ep.title)) {
        console.error(`❌ Content does not contain title line!`);
      }
      if (!content.includes('Content of chapter')) {
        console.error(`❌ Content missing body!`);
      }
    }
  }

  // Clean up
  fs.unlinkSync(TEST_FILE);
}

runTest().catch(console.error);
