
// @ts-ignore
const { PrismaClient } = require('database');

const prisma = new PrismaClient();
const projectId = process.argv[2];

async function main() {
    if (!projectId) {
        console.error('Please provide projectId');
        process.exit(1);
    }

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            seasons: {
                include: {
                    episodes: {
                        include: {
                            scenes: true
                        }
                    }
                }
            }
        }
    });

    if (!project) {
        console.log('Project not found with ID:', projectId);
        console.log('Listing all projects in DB:');
        const allProjects = await prisma.project.findMany({ select: { id: true, name: true } });
        allProjects.forEach(p => console.log(`- ${p.name} (${p.id})`));
        return;
    }

    console.log(`Project: ${project.name}`);
    console.log(`Seasons: ${project.seasons.length}`);
    project.seasons.forEach((s, sIdx) => {
        console.log(`  Season ${s.index}: ${s.title} (Episodes: ${s.episodes.length})`);
        s.episodes.forEach((e, eIdx) => {
            console.log(`    Episode ${e.index}: ${e.name} (Scenes: ${e.scenes.length})`);
            e.scenes.forEach((sc) => {
                console.log(`      Scene ${sc.index}: ${sc.title} (ID: ${sc.id})`);
            });
        });
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
