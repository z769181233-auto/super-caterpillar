import crypto from 'crypto';
import * as fs from 'fs';

type Input = {
    apiKey: string;
    apiSecret: string;
    timestamp: string;
    method: string;
    path: string;
    nonce?: string;
};

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
}

async function main() {
    const configRaw = process.argv[2];
    if (!configRaw) {
        console.error('missing argv[2] config json (excluding body)');
        process.exit(2);
    }
    const i: Input = JSON.parse(configRaw);
    const nonce = i.nonce || 'gate_s4_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');

    // Read body from stdin to avoid shell argument limit
    const body = await readStdin();

    const message = i.apiKey + nonce + i.timestamp + body;
    const signature = crypto.createHmac('sha256', i.apiSecret).update(message).digest('hex');

    console.log(`X-Api-Key:${i.apiKey}`);
    console.log(`X-Nonce:${nonce}`);
    console.log(`X-Timestamp:${i.timestamp}`);
    console.log(`X-Signature:${signature}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
