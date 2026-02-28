import { PrismaClient } from 'database';

const prisma = new PrismaClient();

async function check() {
    const buildId = 'bf67cbdc-79a9-42be-b074-6239a2719064';
    console.log(`Checking build ${buildId}...`);
    const build = await prisma.scriptBuild.findUnique({
        where: { id: buildId },
        include: {
            storySource: true,
            episodes: {
                orderBy: { index: 'asc' },
                include: {
                    sourceRef: true,
                    scenes: {
                        orderBy: { sceneIndex: 'asc' },
                        include: {
                            sourceRef: true,
                            shots: {
                                orderBy: { index: 'asc' },
                                include: { sourceRef: true }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!build) {
        console.log('Build NOT FOUND');
    } else {
        console.log(`Build Found: ${build.id}`);
        console.log(`Episodes count: ${build.episodes?.length}`);
    }
}

check().catch(console.error).finally(() => prisma.$disconnect());
