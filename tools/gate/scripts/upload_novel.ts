import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv'; // Assuming dotenv is available or rely on process.env if loaded

// Load .env
dotenv.config();

const API_KEY = process.env.WORKER_API_KEY;
const API_SECRET = process.env.WORKER_API_SECRET;
const BASE_URL = process.env.API_URL || 'http://localhost:3000';

const FILE_PATH = process.argv[2];

if (!FILE_PATH) {
  console.error('Usage: ts-node upload_novel.ts <file_path>');
  process.exit(1);
}

if (!API_KEY || !API_SECRET) {
  console.error('Missing WORKER_API_KEY or WORKER_API_SECRET env vals');
  process.exit(1);
}

async function upload() {
  try {
    const content = fs.readFileSync(FILE_PATH);
    const contentSha256 = crypto.createHash('sha256').update(content).digest('hex');

    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // P6-0-2 Protocol: Canonical String = apiKey + nonce + timestamp + contentSha256
    // (Because body is streamed/ignored by Guard)
    const canonical = `${API_KEY}${nonce}${timestamp}${contentSha256}`;
    const signature = crypto.createHmac('sha256', API_SECRET).update(canonical).digest('hex');

    const url = `${BASE_URL}/api/storage/novels`;

    const res = await axios.post(url, content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Api-Key': API_KEY,
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Content-SHA256': contentSha256,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    // Output JSON for Bash to parse
    console.log(JSON.stringify(res.data));
  } catch (error: any) {
    console.error('Upload Failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data));
    }
    process.exit(1);
  }
}

upload();
