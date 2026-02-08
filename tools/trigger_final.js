const http = require('http');
const { PrismaClient } = require('database');
const prisma = new PrismaClient();

async function main() {
    const project = await prisma.project.findFirst({
        where: { name: { startsWith: 'E2E Video Project' } },
        orderBy: { createdAt: 'desc' }
    });
    const shot = await prisma.shot.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (!project || !shot) throw new Error('Could not find project or shot');

    console.log(`Triggering SHOT_RENDER for Project: ${project.id}, Shot: ${shot.id}`);

    const postData = JSON.stringify({
        prompt: 'A beautiful sunset over the digital ocean, cinematic, 4k',
        projectId: project.id,
        shotId: shot.id
    });

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/admin/prod-gate/shot-render',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('API Response Status:', res.statusCode);
            console.log('API Response Body:', data);
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

main().catch(console.error).finally(() => prisma.$disconnect());
