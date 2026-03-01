import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.WORKER_API_KEY || 'pilot-key';
const API_SECRET = process.env.WORKER_API_SECRET || 'pilot-secret';
const BASE_URL = process.env.API_URL || 'http://localhost:3000';

const FILE_PATH = process.argv[2];
const PROJECT_ID = process.argv[3];
const ORG_ID = process.argv[4];

async function run() {
  const fileStats = fs.statSync(FILE_PATH);
  const content = fs.readFileSync(FILE_PATH);
  const contentSha256 = 'UNSIGNED';
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const canonical = `${API_KEY}${nonce}${timestamp}${contentSha256}`;
  const signature = crypto.createHmac('sha256', API_SECRET).update(canonical).digest('hex');

  // 我们使用 import-file 接口，它支持 multipart/form-data
  // 但我们的 RequireSignature 装饰器在默认情况下可能对 multipart 有特殊处理或只看 header
  // 这里简单起见，我们模拟一个包含 projectId 和 organizationId 的调用

  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(FILE_PATH));
  form.append('title', 'Stress Test Novel 15M');

  const url = `${BASE_URL}/api/projects/${PROJECT_ID}/novel/import-file`;

  try {
    const res = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'X-Api-Key': API_KEY,
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Content-SHA256': contentSha256,
      },
    });
    console.log(JSON.stringify(res.data));
  } catch (error: any) {
    console.error('Trigger Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}
run();
