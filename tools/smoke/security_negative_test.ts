#!/usr/bin/env ts-node

/**
 * P0-1 Security: Negative Smoke Test
 * 验证：当 HMAC 身份合法但权限不足时，系统必须返回 403 Forbidden。
 */

import * as http from 'http';
import { URL } from 'url';
import { createHash, createHmac } from 'crypto';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-api-key';
const API_SECRET = process.env.API_SECRET || 'test-api-secret';

async function request(method: string, path: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const url = new URL(path, API_BASE_URL);
        const bodyString = body ? JSON.stringify(body) : '';

        // 生成签名 (HmacAuthGuard 期望的格式)
        const timestamp = Date.now().toString();
        const nonce = `nonce_${Date.now()}`;
        const contentSha256 = createHash('sha256').update(bodyString).digest('hex');

        // 注意：这里的签名构造必须与 HmacAuthGuard 对齐
        const message = `${method}\n${path}\n${contentSha256}\n${nonce}\n${timestamp}`;
        const signature = createHmac('sha256', API_SECRET)
            .update(message)
            .digest('hex');

        const options = {
            method,
            headers: {
                'X-Api-Key': API_KEY,
                'X-Nonce': nonce,
                'X-Timestamp': timestamp,
                'X-Signature': signature,
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (bodyString) req.write(bodyString);
        req.end();
    });
}

async function main() {
    console.log('=== P0-1 Security Negative Test ===');

    // 1. 访问需要 project.create 权限的接口
    // 我们假设 test-api-key 可能具备身份但没有 project.create 权限（或者根本就不在 RBAC 表里）
    console.log('Testing: POST /api/projects (Requires project.create)...');
    const res = await request('POST', '/api/projects', {
        name: 'Security Test Project',
        description: 'This should fail if RBAC is working'
    });

    console.log(`Status: ${res.statusCode}`);

    if (res.statusCode === 403) {
        console.log('✅ PASSED: Received 403 Forbidden as expected.');
        process.exit(0);
    } else if (res.statusCode === 201 || res.statusCode === 200) {
        console.log('❌ FAILED: Request succeeded but it should have been blocked by RBAC!');
        process.exit(1);
    } else if (res.statusCode === 401) {
        console.log('❌ FAILED: Received 401 Unauthorized. Signature might be wrong, or API Key not found.');
        console.log('Ensure API_KEY/API_SECRET are valid and exists in DB with minimal permissions.');
        process.exit(1);
    } else {
        console.log(`⚠️ UNCERTAIN: Received status ${res.statusCode}.`);
        console.log('Response body:', res.body);
        // 如果是 400 可能是参数问题，但我们更关心 403
        process.exit(res.statusCode === 403 ? 0 : 1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
