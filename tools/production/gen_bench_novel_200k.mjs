#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const TARGET_FILE = path.join(process.cwd(), 'docs/_evidence/bench_novel_200k.txt');
const CHAPTER_COUNT = 100;
const WORDS_PER_CHAPTER = 2000;

console.log(`Generating ${CHAPTER_COUNT} chapters, ~${CHAPTER_COUNT * WORDS_PER_CHAPTER} words...`);

let content = '';
for (let i = 1; i <= CHAPTER_COUNT; i++) {
  content += `第 ${i} 章：规模验证之章 ${i}\n\n`;
  content += `这是第 ${i} 章的正文内容。`.repeat(WORDS_PER_CHAPTER / 10) + '\n\n';
}

fs.mkdirSync(path.dirname(TARGET_FILE), { recursive: true });
fs.writeFileSync(TARGET_FILE, content);

console.log(`Successfully generated benchmark novel: ${TARGET_FILE}`);
console.log(`File size: ${(fs.statSync(TARGET_FILE).size / 1024 / 1024).toFixed(2)} MB`);
