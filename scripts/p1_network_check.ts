import * as dns from 'dns';
import * as net from 'net';
const { PrismaClient } = require('database');

async function checkDns(hostname: string) {
    return new Promise((resolve) => {
        dns.lookup(hostname, (err, address) => {
            resolve({ success: !err, address, error: err?.message });
        });
    });
}

async function checkTcp(hostname: string, port: number) {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(5000);

        socket.connect(port, hostname, () => {
            socket.destroy();
            resolve({ success: true, durationMs: Date.now() - start });
        });

        socket.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ success: false, error: 'TIMEOUT' });
        });
    });
}

async function checkPg() {
    const prisma = new PrismaClient();
    try {
        const res = await prisma.$queryRawUnsafe('SELECT 1 as "ok"');
        await prisma.$disconnect();
        return { success: true, result: res };
    } catch (err: any) {
        return { success: false, error: err.message, code: err.code };
    }
}

async function run() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        const out = { error: 'DATABASE_URL missing' };
        console.log(JSON.stringify(out, null, 2));
        process.exit(1);
    }

    let parsed: URL;
    try {
        parsed = new URL(dbUrl);
    } catch (e) {
        const out = { error: 'Unparseable url' };
        console.log(JSON.stringify(out, null, 2));
        process.exit(1);
    }

    const host = parsed.hostname;
    const port = parseInt(parsed.port || '5432', 10);

    const dnsRes = await checkDns(host);
    const tcpRes = await checkTcp(host, port);
    const pgRes = await checkPg();

    const report = {
        dns: dnsRes,
        tcp: tcpRes,
        pg: pgRes
    };

    console.log(JSON.stringify(report, null, 2));
}

run();
